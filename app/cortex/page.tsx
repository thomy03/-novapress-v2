"use client";

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useTheme } from '../contexts/ThemeContext';
import { Header } from '../components/layout/Header';
import { CortexControls } from '../components/cortex/CortexControls';
import { CortexDetailPanel } from '../components/cortex/CortexDetailPanel';
import {
  CortexData,
  CortexNode,
  TopicCategory,
  DEMO_CORTEX_DATA,
} from '@/app/types/cortex';

// Dynamic import for the graph (no SSR)
const CortexGraph = dynamic(
  () => import('../components/cortex/CortexGraph').then((mod) => mod.CortexGraph),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: '100%',
          height: 'calc(100vh - 180px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0f',
        }}
      >
        <div style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
          Chargement du Cortex...
        </div>
      </div>
    ),
  }
);

export default function CortexPage() {
  const { theme } = useTheme();
  const router = useRouter();

  // State
  const [data, setData] = useState<CortexData>(DEMO_CORTEX_DATA);
  const [filteredData, setFilteredData] = useState<CortexData>(DEMO_CORTEX_DATA);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<CortexNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<TopicCategory[]>([]);
  const [highlightNodeId, setHighlightNodeId] = useState<string | undefined>();

  // Fetch cortex data
  useEffect(() => {
    async function fetchData() {
      try {
        const { getCortexData } = await import('@/app/lib/api/services/cortex');
        const cortexData = await getCortexData(50, 0.3); // Full data for full-screen
        setData(cortexData);
        setFilteredData(cortexData);
      } catch (error) {
        console.error('Failed to fetch cortex data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Filter data based on search and categories
  useEffect(() => {
    let nodes = data.nodes;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      nodes = nodes.filter((node) =>
        node.name.toLowerCase().includes(query)
      );

      // Highlight matching node if exact match
      const exactMatch = nodes.find(
        (n) => n.name.toLowerCase() === query
      );
      setHighlightNodeId(exactMatch?.id);
    } else {
      setHighlightNodeId(undefined);
    }

    // Filter by categories
    if (selectedCategories.length > 0) {
      nodes = nodes.filter((node) =>
        selectedCategories.includes(node.category as TopicCategory)
      );
    }

    // Filter edges to only include those between filtered nodes
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = data.edges.filter((edge) => {
      const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
      const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });

    setFilteredData({
      nodes,
      edges,
      central_node_id: nodes[0]?.id || data.central_node_id,
      last_updated: data.last_updated,
    });
  }, [data, searchQuery, selectedCategories]);

  // Handlers
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleCategoryFilter = useCallback((categories: TopicCategory[]) => {
    setSelectedCategories(categories);
  }, []);

  const handleNodeClick = useCallback((node: CortexNode) => {
    setSelectedNode(node);
  }, []);

  const handleNodeHover = useCallback((node: CortexNode | null) => {
    // Could add hover effects here
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0f',
        color: '#FFFFFF',
      }}
    >
      <Header />

      {/* Page header */}
      <div
        style={{
          padding: '24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: 'rgba(10, 10, 15, 0.95)',
        }}
      >
        <div
          style={{
            maxWidth: '1400px',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '8px',
            }}
          >
            <button
              onClick={() => router.push('/')}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.6)',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>←</span> Retour
            </button>
            <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>|</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: 'rgba(255, 255, 255, 0.6)',
              }}
            >
              Intelligence Hub
            </span>
          </div>
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 600,
              margin: 0,
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            Cortex Thematique
          </h1>
          <p
            style={{
              margin: '8px 0 0 0',
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.6)',
            }}
          >
            Explorez les connexions entre les sujets d'actualite. {filteredData.nodes.length} topics, {filteredData.edges.length} connexions.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div
          style={{
            maxWidth: '1400px',
            margin: '0 auto',
          }}
        >
          <CortexControls
            onSearch={handleSearch}
            onCategoryFilter={handleCategoryFilter}
            selectedCategories={selectedCategories}
          />
        </div>
      </div>

      {/* Graph container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 'calc(100vh - 220px)',
          background:
            'radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0f 100%)',
        }}
      >
        {/* Stars background */}
        <div
          className="cortex-stars"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
          }}
        />

        {loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'rgba(255, 255, 255, 0.6)',
            }}
          >
            Chargement du Cortex...
          </div>
        ) : filteredData.nodes.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'rgba(255, 255, 255, 0.6)',
              textAlign: 'center',
              padding: '40px',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>
              Aucun topic trouve
            </h3>
            <p style={{ margin: 0, fontSize: '14px' }}>
              Essayez une autre recherche ou modifiez les filtres.
            </p>
          </div>
        ) : (
          <CortexGraph
            data={filteredData}
            compact={false}
            height={window.innerHeight - 220}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            highlightNodeId={highlightNodeId}
            showLabels={true}
            enableDrag={true}
            enableZoom={true}
          />
        )}
      </div>

      {/* Detail panel */}
      {selectedNode && (
        <CortexDetailPanel node={selectedNode} onClose={handleClosePanel} />
      )}

      {/* Legend */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '24px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          padding: '12px 16px',
          zIndex: 30,
        }}
      >
        <div
          style={{
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'rgba(255, 255, 255, 0.5)',
            marginBottom: '8px',
          }}
        >
          Legende
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#2563EB',
              }}
            />
            <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>
              Taille = Nombre de syntheses
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '24px',
                height: '2px',
                background: 'linear-gradient(90deg, transparent, #3B82F6, transparent)',
              }}
            />
            <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>
              Lien = Similarite semantique
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                boxShadow: '0 0 8px 2px rgba(16, 185, 129, 0.6)',
                backgroundColor: 'transparent',
              }}
            />
            <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>
              Glow = Topic actif
            </span>
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.5)',
          zIndex: 30,
        }}
      >
        Scroll pour zoomer • Cliquez-glissez pour deplacer
      </div>
    </div>
  );
}
