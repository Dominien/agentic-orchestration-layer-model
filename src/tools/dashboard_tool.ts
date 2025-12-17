import { Type, Schema } from '@google/genai';

export const render_dashboard = {
  name: 'render_dashboard',
  description: 'MANDATORY: Use this tool whenever the user asks for a comparison, trend, or distribution. It renders a beautiful interactive chart on the frontend. Do NOT use it for simple text answers. Configuring this correctly will delight the user.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'The main title of the dashboard (e.g., "Revenue Analysis 2024").'
      },
      widgets: {
        type: Type.ARRAY,
        description: 'List of widgets/charts to display.',
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: 'Unique ID for the widget.' },
            type: { 
                type: Type.STRING, 
                description: 'Type of widget: "bar", "line", "pie", "stat".',
                enum: ['bar', 'line', 'pie', 'stat']
            },
            title: { type: Type.STRING, description: 'Title of the specific chart.' },
            description: { type: Type.STRING, description: 'Optional subtitle or explanation.' },
            data: {
                type: Type.ARRAY,
                description: 'Array of data objects for the chart. (For "stat", leave empty).',
                items: { type: Type.OBJECT } // Generic object for data points
            },
            config: {
                type: Type.OBJECT,
                description: 'Configuration for axis, keys, labels, or stat values.',
                properties: {
                    xKey: { type: Type.STRING, description: 'Key for X-axis (e.g., "month").' },
                    yKeys: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Keys for Y-axis (series).' },
                    nameKey: { type: Type.STRING, description: 'Key for Pie slice names.' },
                    valueKey: { type: Type.STRING, description: 'Key for Pie slice values.' },
                    statValue: { type: Type.STRING, description: 'Value for Stat Card (e.g. "$50k").' },
                    statLabel: { type: Type.STRING, description: 'Label for Stat Card (e.g "Total Revenue").' },
                    statTrend: { type: Type.STRING, description: 'Trend indicator (e.g "+12%").' }
                }
            }
          },
          required: ['id', 'type', 'title', 'config']
        }
      }
    },
    required: ['title', 'widgets']
  } as Schema
};

export const renderDashboardTool = async (args: any) => {
  // This tool is primarily for the frontend to render visuals.
  // The backend just acknowledges the request.
  return "Dashboard blueprint generated and sent to frontend.";
};
