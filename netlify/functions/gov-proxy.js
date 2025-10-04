const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const { query } = JSON.parse(event.body);
        if (!query) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Query is required' }) };
        }

        const GOV_API_KEY = process.env.GOV_API_KEY;
        if (!GOV_API_KEY) {
            console.error("GOV_API_KEY not configured in Netlify environment variables.");
            return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
        }

        // Helper function to search Federal Register
        const searchFederalRegister = async (q) => {
            try {
                const url = `https://www.federalregister.gov/api/v1/documents.json?conditions[term]=${encodeURIComponent(q)}&per_page=10`;
                const response = await fetch(url);
                if (!response.ok) return [];
                const data = await response.json();
                return (data.results || []).map(doc => ({
                    title: doc.title,
                    date: doc.publication_date,
                    url: doc.html_url,
                    abstract: doc.abstract || 'No abstract available',
                    fullText: doc.abstract || doc.title,
                    source: 'Federal Register',
                    type: 'RULE'
                }));
            } catch (error) {
                console.error('Federal Register API error:', error);
                return [];
            }
        };

        // Helper function to search Congress.gov
        const searchCongressGov = async (q) => {
            try {
                const url = `https://api.congress.gov/v3/bill?api_key=${GOV_API_KEY}&format=json&limit=50`;
                const response = await fetch(url);
                if (!response.ok) return [];
                const data = await response.json();
                const filtered = (data.bills || []).filter(bill => 
                    bill.title?.toLowerCase().includes(q.toLowerCase())
                );
                return filtered.slice(0, 10).map(bill => ({
                    title: bill.title || 'Untitled Bill',
                    date: bill.updateDate || bill.introducedDate || 'N/A',
                    url: bill.url || '#',
                    abstract: `${bill.type} ${bill.number} - ${bill.title}`,
                    fullText: bill.title || '',
                    source: 'Congress.gov',
                    type: 'BILL'
                }));
            } catch (error) {
                console.error('Congress.gov API error:', error);
                return [];
            }
        };

        const [federalRegisterResults, congressResults] = await Promise.all([
            searchFederalRegister(query),
            searchCongressGov(query)
        ]);

        const allResults = [...federalRegisterResults, ...congressResults];

        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' // Adjust for production if needed
            },
            body: JSON.stringify({ results: allResults })
        };

    } catch (error) {
        console.error('Proxy Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
    }
};
