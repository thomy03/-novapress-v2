"""
Build & Deploy Fish Speech on RunPod Serverless.
Same pattern as build_and_deploy.py but for Fish Speech OpenAudio S1-mini.

Usage: python scripts/build_deploy_fish_speech.py
"""
import os
import re
import subprocess
import sys
import time

RUNPOD_API_KEY = os.environ.get(
    "RUNPOD_API_KEY",
    "rpa_9S44UDGTAMYGLA5ZMI0IRVDM0P0THZZF7K49L60Yu223b8"
)

DOCKER_IMAGE = "epicurien03/fish-speech-runpod"
DOCKER_TAG = "v1"

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
HANDLER_PATH = os.path.join(SCRIPTS_DIR, "fish_speech_handler.py")
PREPROCESSOR_PATH = os.path.join(SCRIPTS_DIR, "..", "app", "services", "french_text_preprocessor.py")

# Dockerfile content (embedded to upload to build pod)
DOCKERFILE = r'''# Fish Speech OpenAudio S1-mini — RunPod Serverless
FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y ffmpeg portaudio19-dev libsox-dev git && \
    rm -rf /var/lib/apt/lists/*

# Clone Fish Speech repo (needed for tools.api_server)
RUN git clone --depth 1 https://github.com/fishaudio/fish-speech.git /app/fish-speech

# Install Fish Speech with CUDA support
RUN cd /app/fish-speech && pip install --no-cache-dir -e ".[cu124]"

# Install additional deps
RUN pip install --no-cache-dir \
    runpod>=1.6.0 \
    pydub>=0.25.1 \
    num2words>=0.5.13 \
    requests>=2.31.0 \
    "huggingface_hub[cli]>=0.20.0"

# Download model weights at build time
RUN mkdir -p /app/checkpoints && \
    huggingface-cli download fishaudio/openaudio-s1-mini \
    --local-dir /app/checkpoints/openaudio-s1-mini

# Copy handler and preprocessor
COPY handler.py /app/handler.py
COPY french_text_preprocessor.py /app/french_text_preprocessor.py

CMD ["python", "/app/handler.py"]
'''


def ssh(ip, port, cmd, timeout=600):
    full = (f'ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 '
            f'-o ServerAliveInterval=60 -o ServerAliveCountMax=5 '
            f'-p {port} root@{ip} "{cmd}"')
    return subprocess.run(full, shell=True, capture_output=True, text=True, timeout=timeout)


def scp_to(ip, port, local, remote):
    cmd = f'scp -o StrictHostKeyChecking=no -P {port} "{local}" root@{ip}:{remote}'
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=120)


def main():
    import runpod
    runpod.api_key = RUNPOD_API_KEY

    print("=" * 60)
    print("  BUILD & DEPLOY FISH SPEECH (OpenAudio S1-mini)")
    print("=" * 60)

    # Verify files exist
    if not os.path.exists(HANDLER_PATH):
        print(f"ERROR: Handler not found: {HANDLER_PATH}")
        sys.exit(1)
    if not os.path.exists(PREPROCESSOR_PATH):
        print(f"ERROR: Preprocessor not found: {PREPROCESSOR_PATH}")
        sys.exit(1)

    # Docker Hub credentials
    docker_user = input("Docker Hub username [epicurien03]: ").strip() or "epicurien03"
    docker_pass = input("Docker Hub password/token: ").strip()
    if not docker_pass:
        print("ERROR: Docker Hub password required!")
        sys.exit(1)

    # 1. Create build pod (needs GPU for model download verification)
    print("\n[1/5] Creating build pod on RunPod...")
    try:
        pod = runpod.create_pod(
            name="fish-speech-docker-build",
            image_name="docker:24-dind",
            gpu_type_id="NVIDIA GeForce RTX 4090",
            gpu_count=1,
            volume_in_gb=100,  # Model + Docker layers need space
            container_disk_in_gb=60,
            min_vcpu_count=8,
            min_memory_in_gb=32,
            ports="22/tcp",
            support_public_ip=True,
            docker_args="--privileged",
            env={"PUBLIC_KEY": open(os.path.expanduser("~/.ssh/id_ed25519.pub")).read().strip()},
        )
        pod_id = pod["id"]
        print(f"  Pod: {pod_id}")
    except Exception as e:
        print(f"  Error creating pod: {e}")
        sys.exit(1)

    # 2. Wait for SSH
    print("\n[2/5] Waiting for pod SSH access...")
    start = time.time()
    ip, port = None, None
    while time.time() - start < 300:
        pod_info = runpod.get_pod(pod_id)
        runtime = pod_info.get("runtime", {})
        if runtime and runtime.get("ports"):
            for p in runtime["ports"]:
                if p.get("privatePort") == 22 and p.get("ip"):
                    ip = p["ip"]
                    port = p["publicPort"]
                    break
        if ip and port:
            time.sleep(15)
            print(f"  SSH ready: {ip}:{port}")
            break
        time.sleep(10)
        print(f"  Waiting... ({int(time.time() - start)}s)")

    if not ip:
        print("  Timeout waiting for SSH!")
        sys.exit(1)

    # 3. Upload files and build
    print("\n[3/5] Uploading files and building Docker image...")

    # Upload handler
    print("  Uploading handler...")
    scp_to(ip, port, HANDLER_PATH, "/workspace/handler.py")

    # Upload preprocessor
    print("  Uploading preprocessor...")
    scp_to(ip, port, PREPROCESSOR_PATH, "/workspace/french_text_preprocessor.py")

    # Write Dockerfile on pod
    import tempfile
    with tempfile.NamedTemporaryFile(mode="w", suffix=".dockerfile", delete=False) as f:
        f.write(DOCKERFILE)
        tmp_dockerfile = f.name
    scp_to(ip, port, tmp_dockerfile, "/workspace/Dockerfile")
    os.unlink(tmp_dockerfile)

    # Build Docker image (this takes ~15-20 min with model download)
    print("  Building Docker image (this takes ~15-20 min)...")
    print("  Includes: Fish Speech install + model download (~5GB)...")
    result = ssh(ip, port,
        f"cd /workspace && docker build -t {DOCKER_IMAGE}:{DOCKER_TAG} -f Dockerfile .",
        timeout=2400)  # 40 min max
    if result.returncode != 0:
        print(f"  Build FAILED!")
        print(result.stderr[-1000:] if result.stderr else result.stdout[-1000:])
        print(f"\n  Pod {pod_id} left running for debugging.")
        print(f"  SSH: ssh -p {port} root@{ip}")
        sys.exit(1)
    print("  Build OK!")

    # 4. Push to Docker Hub
    print(f"\n[4/5] Pushing {DOCKER_IMAGE}:{DOCKER_TAG} to Docker Hub...")
    ssh(ip, port, f"echo '{docker_pass}' | docker login -u {docker_user} --password-stdin")
    result = ssh(ip, port, f"docker push {DOCKER_IMAGE}:{DOCKER_TAG}", timeout=600)
    if result.returncode != 0:
        print(f"  Push failed!")
        print(result.stderr[-500:])
        sys.exit(1)
    print(f"  Pushed: {DOCKER_IMAGE}:{DOCKER_TAG}")

    # Terminate build pod
    print("  Terminating build pod...")
    runpod.terminate_pod(pod_id)

    # 5. Create serverless endpoint
    print("\n[5/5] Creating serverless endpoint...")
    import requests
    resp = requests.post(
        "https://api.runpod.io/v2/endpoints",
        headers={"Authorization": f"Bearer {RUNPOD_API_KEY}"},
        json={
            "name": "fish-speech-novapress",
            "templateId": None,
            "dockerImage": f"{DOCKER_IMAGE}:{DOCKER_TAG}",
            "gpuIds": "AMPERE_48,AMPERE_24",  # A100/A6000 (24GB+ VRAM)
            "workersMin": 0,
            "workersMax": 2,
            "idleTimeout": 5,
            "flashBoot": True,
        }
    )
    if resp.ok:
        endpoint_id = resp.json().get("id", "")
        print(f"  Endpoint created: {endpoint_id}")

        # Update .env
        env_path = os.path.join(SCRIPTS_DIR, "..", ".env")
        if os.path.exists(env_path):
            content = open(env_path).read()
            if "RUNPOD_FISH_SPEECH_ENDPOINT_ID=" in content:
                content = re.sub(r'RUNPOD_FISH_SPEECH_ENDPOINT_ID=\S*',
                    f'RUNPOD_FISH_SPEECH_ENDPOINT_ID={endpoint_id}', content)
            else:
                content += f"\nRUNPOD_FISH_SPEECH_ENDPOINT_ID={endpoint_id}\n"
            open(env_path, "w").write(content)
            print(f"  .env updated with RUNPOD_FISH_SPEECH_ENDPOINT_ID={endpoint_id}")

        print(f"\n  To use Fish Speech, set in .env:")
        print(f"    TTS_PROVIDER=fish_speech")
        print(f"    RUNPOD_FISH_SPEECH_ENDPOINT_ID={endpoint_id}")
    else:
        print(f"  Endpoint creation failed: {resp.status_code}")
        print(f"  {resp.text[:300]}")
        print(f"\n  Create manually at https://www.runpod.io/console/serverless")
        print(f"  Image: {DOCKER_IMAGE}:{DOCKER_TAG}")

    print(f"\n{'='*60}")
    print(f"  DONE!")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
