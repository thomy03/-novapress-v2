#!/usr/bin/env python3
"""
Simple Flask API for NovaPress AI v2 - Serves syntheses data
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import json
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for React app

# Database path
DB_PATH = "data/articles.db"

def get_db_connection():
    """Get database connection"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

def format_synthesis(row):
    """Format synthesis data for API response"""
    try:
        return {
            'id': row['id'],
            'titre': row.get('titre', row.get('title', 'Sans titre')),
            'contenu': row.get('contenu', row.get('content', row.get('summary', 'Contenu non disponible')))[:500],
            'date': row.get('date_creation', row.get('created_at', datetime.now().isoformat())),
            'tags': json.loads(row.get('themes', '[]')) if row.get('themes') and row.get('themes') != '[]' else ['Général'],
            'sources': json.loads(row.get('sources', '[]')) if row.get('sources') and row.get('sources') != '[]' else []
        }
    except Exception as e:
        print(f"Error formatting synthesis: {e}")
        return None

@app.route('/api/syntheses', methods=['GET'])
def get_syntheses():
    """Get all syntheses"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        # Try topics table first (main table)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, titre, contenu, date_creation, themes, sources 
            FROM topics 
            ORDER BY date_creation DESC 
            LIMIT 100
        """)
        
        topics = cursor.fetchall()
        syntheses = []
        
        for row in topics:
            formatted = format_synthesis(row)
            if formatted:
                syntheses.append(formatted)
        
        # If no topics found, try syntheses table
        if not syntheses:
            cursor.execute("""
                SELECT id, title as titre, content as contenu, created_at as date_creation, 
                       themes, sources 
                FROM syntheses 
                ORDER BY created_at DESC 
                LIMIT 100
            """)
            
            synthesis_rows = cursor.fetchall()
            for row in synthesis_rows:
                formatted = format_synthesis(row)
                if formatted:
                    syntheses.append(formatted)
        
        conn.close()
        
        return jsonify({
            'syntheses': syntheses,
            'count': len(syntheses),
            'status': 'success'
        })
        
    except Exception as e:
        print(f"API Error: {e}")
        return jsonify({
            'syntheses': [],
            'count': 0,
            'error': str(e),
            'status': 'error'
        }), 500

@app.route('/api/reboot/<int:article_id>', methods=['POST'])
def reboot_article(article_id):
    """Reboot/regenerate an article (placeholder)"""
    try:
        # Simulate reboot process
        return jsonify({
            'success': True,
            'message': f'Article {article_id} en cours de reboot',
            'status': 'processing'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/status', methods=['GET'])
def api_status():
    """API health check"""
    try:
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as count FROM topics")
            topics_count = cursor.fetchone()['count']
            
            cursor.execute("SELECT COUNT(*) as count FROM syntheses")  
            syntheses_count = cursor.fetchone()['count']
            
            conn.close()
            
            return jsonify({
                'status': 'healthy',
                'database': 'connected',
                'topics_count': topics_count,
                'syntheses_count': syntheses_count,
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({
                'status': 'unhealthy',
                'database': 'disconnected',
                'error': 'Cannot connect to database'
            }), 500
            
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

if __name__ == '__main__':
    print("Starting NovaPress AI v2 API...")
    print(f"Database path: {DB_PATH}")
    print(f"Database exists: {os.path.exists(DB_PATH)}")
    
    # Test database connection
    conn = get_db_connection()
    if conn:
        print("✅ Database connection successful")
        conn.close()
    else:
        print("❌ Database connection failed")
    
    app.run(debug=True, host='0.0.0.0', port=5000)