'use client';

import { useState, useEffect } from 'react';
import { TemplateService, TemplateData } from '@/lib/template-service';
import { templatePartials } from '@/lib/template-partials';

export default function TestTemplatePage() {
  const [renderedTemplate, setRenderedTemplate] = useState<string>('');
  const [template, setTemplate] = useState<string>('');
  const [templateInfo, setTemplateInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const testData: TemplateData = {
    badgeName: 'Test Badge Name',
    imageUrl: '/assets/question-placer@2x.png',
    socialMediaHandles: [
      { platform: 'x', handle: '@testuser', iconUrl: '/assets/social-icons/x-icon-white.svg' },
      { platform: 'discord', handle: 'testuser#1234', iconUrl: '/assets/social-icons/discord-icon-white.svg' }
    ],
    decorations: {
      frills: { left: true, right: true, lower: true }
    }
  };

  useEffect(() => {
    const fetchAndRenderTemplate = async () => {
      try {
        setLoading(true);
        setError('');

        // Fetch COG Classic template from API
        const response = await fetch('/api/templates/cog-classic-2026');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch template: ${response.status}`);
        }

        const data = await response.json();
        setTemplate(data.template);
        setTemplateInfo(data.templateInfo);

        // Render template with test data
        const rendered = TemplateService.renderTemplate(
          data.template, 
          testData, 
          templatePartials
        );
        setRenderedTemplate(rendered);
      } catch (err) {
        console.error('Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchAndRenderTemplate();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center">
        <div className="text-white text-xl">Loading template...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center">
        <div className="text-red-400 text-xl">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111111] p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8 font-montserrat">
          Template Test Page
        </h1>
        
        {/* Template Info */}
        {templateInfo && (
          <div className="mb-6 p-4 bg-gray-800 rounded-lg">
            <h2 className="text-xl font-semibold text-white mb-2">Template Information</h2>
            <div className="text-gray-300 space-y-1">
              <p><strong>ID:</strong> {templateInfo.id}</p>
              <p><strong>Name:</strong> {templateInfo.name}</p>
              <p><strong>Description:</strong> {templateInfo.description}</p>
              <p><strong>Type:</strong> {templateInfo.template_type}</p>
              <p><strong>Version:</strong> {templateInfo.version}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Rendered Template */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Rendered Template</h2>
            <div className="border border-gray-600 p-4 bg-gray-900 rounded-lg">
              <div 
                className="badge-preview-container"
                dangerouslySetInnerHTML={{ __html: renderedTemplate }}
              />
            </div>
          </div>
          
          {/* Template Source */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Template Source</h2>
            <div className="border border-gray-600 p-4 bg-gray-900 rounded-lg">
              <pre className="text-sm text-gray-300 overflow-auto whitespace-pre-wrap">
                {template}
              </pre>
            </div>
          </div>
        </div>

        {/* Test Data */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-white mb-4">Test Data</h2>
          <div className="border border-gray-600 p-4 bg-gray-900 rounded-lg">
            <pre className="text-sm text-gray-300 overflow-auto">
              {JSON.stringify(testData, null, 2)}
            </pre>
          </div>
        </div>

        {/* Partials */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-white mb-4">Template Partials</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(templatePartials).map(([name, content]) => (
              <div key={name} className="border border-gray-600 p-4 bg-gray-900 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-2">{name}</h3>
                <pre className="text-xs text-gray-300 overflow-auto whitespace-pre-wrap">
                  {content}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
