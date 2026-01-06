import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const FEATURES_FILE = path.join(process.cwd(), '.claude', 'features.json');

// GET - Lire features.json
export async function GET() {
  try {
    const fileContent = await fs.readFile(FEATURES_FILE, 'utf-8');
    const data = JSON.parse(fileContent);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error reading features.json:', error);

    // Si le fichier n'existe pas, retourner une structure vide
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json(
        { error: 'features.json not found', path: FEATURES_FILE },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to read features.json' },
      { status: 500 }
    );
  }
}

// POST - Sauvegarder features.json
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Validation basique
    if (!data.metadata || !data.phases) {
      return NextResponse.json(
        { error: 'Invalid data structure' },
        { status: 400 }
      );
    }

    // Mettre à jour last_updated
    data.metadata.last_updated = new Date().toISOString().split('T')[0];

    // Sauvegarder avec formatage
    await fs.writeFile(
      FEATURES_FILE,
      JSON.stringify(data, null, 2),
      'utf-8'
    );

    return NextResponse.json({ success: true, updated: data.metadata.last_updated });
  } catch (error) {
    console.error('Error writing features.json:', error);
    return NextResponse.json(
      { error: 'Failed to write features.json' },
      { status: 500 }
    );
  }
}

// PATCH - Mettre à jour une feature spécifique
export async function PATCH(request: NextRequest) {
  try {
    const { featureId, phaseId, updates } = await request.json();

    if (!featureId || !phaseId || !updates) {
      return NextResponse.json(
        { error: 'Missing featureId, phaseId, or updates' },
        { status: 400 }
      );
    }

    // Lire le fichier actuel
    const fileContent = await fs.readFile(FEATURES_FILE, 'utf-8');
    const data = JSON.parse(fileContent);

    // Trouver et mettre à jour la feature
    let updated = false;
    for (const phase of data.phases) {
      if (phase.id === phaseId) {
        const feature = phase.features.find((f: { id: string }) => f.id === featureId);
        if (feature) {
          Object.assign(feature, updates);
          updated = true;
          break;
        }
      }
    }

    if (!updated) {
      return NextResponse.json(
        { error: 'Feature not found' },
        { status: 404 }
      );
    }

    // Recalculer les métadonnées
    let pending = 0, in_progress = 0, completed = 0;
    for (const phase of data.phases) {
      for (const feature of phase.features) {
        if (feature.status === 'pending') pending++;
        else if (feature.status === 'in_progress') in_progress++;
        else if (feature.status === 'completed') completed++;
      }
    }

    data.metadata.pending = pending;
    data.metadata.in_progress = in_progress;
    data.metadata.completed = completed;
    data.metadata.last_updated = new Date().toISOString().split('T')[0];

    // Sauvegarder
    await fs.writeFile(
      FEATURES_FILE,
      JSON.stringify(data, null, 2),
      'utf-8'
    );

    return NextResponse.json({
      success: true,
      feature: { featureId, phaseId, ...updates },
      metadata: data.metadata
    });
  } catch (error) {
    console.error('Error updating feature:', error);
    return NextResponse.json(
      { error: 'Failed to update feature' },
      { status: 500 }
    );
  }
}
