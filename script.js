// Configuration
const CONFIG = {
    supabase: {
        url: 'https://qfmxuqvpgqnuqvdvjfzk.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmbXh1cXZwZ3FudXF2ZHZqZnprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0ODY5NzQsImV4cCI6MjA3NTA2Mjk3NH0.tHbvGQXLqRqvX8_GxUlVvZlqQGT7R7lLXPVUQR2qN9A'
    },
    gemini: {
        apiKey: 'AIzaSyBPAuePrR_NvWQsEp8oxH2cneX8E7lh2AA'
    },
    govApis: {
        apiKey: 'gFORSLMWKq2Pd5AjnmlNcrPBdYJ4ipP0dN23PI8x'
    }
};

// Niche keywords mapping
const NICHE_KEYWORDS = {
    fintech: ['SEC', 'FinCEN', 'cryptocurrency', 'blockchain', 'financial technology', 'digital currency', 'payment'],
    healthtech: ['FDA', 'HHS', 'healthcare', 'medical device', 'pharmaceutical', 'clinical trial', 'drug'],
    ai: ['artificial intelligence', 'privacy', 'data protection', 'cybersecurity', 'GDPR', 'machine learning'],
    energy: ['EPA', 'climate', 'energy', 'renewable', 'carbon', 'environmental', 'emissions'],
    defense: ['DOD', 'defense', 'military', 'contract', 'procurement', 'FAR', 'DFARS'],
    cannabis: ['cannabis', 'marijuana', 'hemp', 'THC', 'CBD', 'controlled substance'],
    transport: ['DOT', 'NHTSA', 'autonomous vehicle', 'transportation', 'vehicle safety', 'aviation'],
    agriculture: ['USDA', 'FDA', 'agriculture', 'food safety', 'farming', 'pesticide', 'organic'],
    telecom: ['FCC', 'telecommunications', 'broadband', 'net neutrality', 'spectrum', 'media'],
    advocacy: ['lobbying', 'advocacy', 'regulation', 'compliance', 'policy']
};

// State
let currentDocumentText = '';
let currentDocumentTitle = '';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const nicheFilters = document.getElementById('nicheFilters');
const resultsContainer = document.getElementById('resultsContainer');
const loadingIndicator = document.getElementById('loadingIndicator');
const emptyState = document.getElementById('emptyState');
const emailModal = document.getElementById('emailModal');
const emailInput = document.getElementById('emailInput');
const submitEmail = document.getElementById('submitEmail');
const cancelEmail = document.getElementById('cancelEmail');

// Event Listeners
searchBtn.addEventListener('click', () => performSearch(searchInput.value));
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch(searchInput.value);
});

nicheFilters.addEventListener('click', (e) => {
    if (e.target.classList.contains('niche-tag')) {
        const niche = e.target.dataset.niche;
        const keywords = NICHE_KEYWORDS[niche];
        performSearch(keywords[0]);
    }
});

cancelEmail.addEventListener('click', () => {
    emailModal.classList.add('hidden');
    emailInput.value = '';
});

submitEmail.addEventListener('click', handleEmailSubmit);

// Main Search Function
async function performSearch(query) {
    if (!query || query.trim() === '') {
        alert('Please enter a search term');
        return;
    }

    showLoading();
    
    try {
        // Search Federal Register and Congress.gov APIs in parallel
        // Note: GovInfo API removed due to CORS restrictions in browser
        const [federalRegisterResults, congressResults] = await Promise.all([
            searchFederalRegister(query),
            searchCongressGov(query)
        ]);

        // Combine and display results
        const allResults = [
            ...federalRegisterResults.map(r => ({ ...r, source: 'Federal Register', type: 'RULE' })),
            ...congressResults.map(r => ({ ...r, source: 'Congress.gov', type: 'BILL' }))
        ];

        displayResults(allResults);
    } catch (error) {
        console.error('Search error:', error);
        alert('An error occurred while searching. Please try again.');
    } finally {
        hideLoading();
    }
}

// Federal Register API
async function searchFederalRegister(query) {
    try {
        const url = `https://www.federalregister.gov/api/v1/documents.json?conditions[term]=${encodeURIComponent(query)}&per_page=10`;
        const response = await fetch(url);
        const data = await response.json();
        
        return (data.results || []).map(doc => ({
            title: doc.title,
            date: doc.publication_date,
            url: doc.html_url,
            abstract: doc.abstract || 'No abstract available',
            fullText: doc.abstract || doc.title
        }));
    } catch (error) {
        console.error('Federal Register API error:', error);
        return [];
    }
}

// Congress.gov API
async function searchCongressGov(query) {
    try {
        const url = `https://api.congress.gov/v3/bill?api_key=${CONFIG.govApis.apiKey}&format=json&limit=10`;
        const response = await fetch(url);
        const data = await response.json();
        
        // Filter results by query
        const filtered = (data.bills || []).filter(bill => 
            bill.title?.toLowerCase().includes(query.toLowerCase())
        );
        
        return filtered.slice(0, 10).map(bill => ({
            title: bill.title || 'Untitled Bill',
            date: bill.updateDate || bill.introducedDate || 'N/A',
            url: bill.url || '#',
            abstract: `${bill.type} ${bill.number} - ${bill.title}`,
            fullText: bill.title || ''
        }));
    } catch (error) {
        console.error('Congress.gov API error:', error);
        return [];
    }
}

// GovInfo API removed due to CORS restrictions in browser environment
// For production, this would require a backend proxy server

// Display Results
function displayResults(results) {
    resultsContainer.innerHTML = '';
    emptyState.classList.add('hidden');

    if (results.length === 0) {
        resultsContainer.innerHTML = `
            <div class="text-center py-12">
                <p class="text-gray-600">No results found. Try a different search term.</p>
            </div>
        `;
        return;
    }

    results.forEach(result => {
        const card = createResultCard(result);
        resultsContainer.appendChild(card);
    });
}

// Create Result Card
function createResultCard(result) {
    const card = document.createElement('div');
    card.className = 'result-card bg-white rounded-lg shadow-md p-6';
    
    const typeColors = {
        'RULE': 'bg-blue-100 text-blue-800',
        'BILL': 'bg-green-100 text-green-800',
        'DOCUMENT': 'bg-purple-100 text-purple-800'
    };
    
    card.innerHTML = `
        <div class="flex justify-between items-start mb-3">
            <span class="px-3 py-1 ${typeColors[result.type]} text-xs font-semibold rounded-full">
                [${result.type}] ${result.source}
            </span>
            <span class="text-sm text-gray-500">${result.date}</span>
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">${result.title}</h3>
        <p class="text-gray-600 text-sm mb-4">${result.abstract.substring(0, 200)}${result.abstract.length > 200 ? '...' : ''}</p>
        <div class="flex gap-3">
            <button class="generate-summary-btn bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                Generate AI Summary
            </button>
            <a href="${result.url}" target="_blank" class="border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                View Original
            </a>
        </div>
        <div class="summary-container mt-4 hidden">
            <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <h4 class="font-semibold text-gray-900 mb-2">AI Summary:</h4>
                <div class="summary-text text-gray-700"></div>
                <button class="download-pdf-btn mt-3 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                    Download PDF
                </button>
            </div>
        </div>
    `;
    
    // Add event listener for summary generation
    const generateBtn = card.querySelector('.generate-summary-btn');
    generateBtn.addEventListener('click', () => {
        currentDocumentText = result.fullText;
        currentDocumentTitle = result.title;
        emailModal.classList.remove('hidden');
        
        // Store reference to this card for later
        generateBtn.dataset.cardId = Math.random().toString(36).substring(7);
        card.dataset.cardId = generateBtn.dataset.cardId;
    });
    
    return card;
}

// Handle Email Submit
async function handleEmailSubmit() {
    const email = emailInput.value.trim();
    
    if (!email || !validateEmail(email)) {
        alert('Please enter a valid email address');
        return;
    }
    
    try {
        // Save lead to Supabase
        await saveLeadToSupabase(email);
        
        // Generate AI summary
        const summary = await generateAISummary(currentDocumentText);
        
        // Display summary
        displaySummary(summary);
        
        // Close modal
        emailModal.classList.add('hidden');
        emailInput.value = '';
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred. Please try again.');
    }
}

// Save Lead to Supabase
async function saveLeadToSupabase(email) {
    try {
        const response = await fetch(`${CONFIG.supabase.url}/rest/v1/leads`, {
            method: 'POST',
            headers: {
                'apikey': CONFIG.supabase.anonKey,
                'Authorization': `Bearer ${CONFIG.supabase.anonKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                email: email,
                search_topics: [searchInput.value]
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to save lead');
        }
    } catch (error) {
        console.error('Supabase error:', error);
        // Continue even if lead saving fails
    }
}

// Generate AI Summary with Gemini
async function generateAISummary(text) {
    try {
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${CONFIG.gemini.apiKey}`;
        console.log("Attempting to call Gemini API with key:", CONFIG.gemini.apiKey);
        console.log("Gemini API URL:", geminiApiUrl);
        let response = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Summarize the following document excerpt in 3 practical key points, in simple language:\n\n${text}` }] }]
            })
        });
        console.log("Gemini API response status:", response.status);
        const data = await response.json();
        console.log("Gemini API response data:", data);
        if (response.ok && data.candidates && data.candidates.length > 0) {
            return data.candidates[0].content.parts[0].text;
        } else {
            console.error("Gemini API error:", data);
            return `AI Summary temporarily unavailable. Here's the document excerpt:\n\n${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`;
        }
    } catch (error) {
        console.error('Gemini API error:', error);
        return `AI Summary temporarily unavailable. Here's the document excerpt:\n\n${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`;
    }
}// Display Summary
function displaySummary(summary) {
    // Find all cards and show summary in the most recent one
    const cards = document.querySelectorAll('.result-card');
    const lastCard = cards[cards.length - 1];
    
    if (lastCard) {
        const summaryContainer = lastCard.querySelector('.summary-container');
        const summaryText = lastCard.querySelector('.summary-text');
        const downloadBtn = lastCard.querySelector('.download-pdf-btn');
        
        summaryText.textContent = summary;
        summaryContainer.classList.remove('hidden');
        
        // Add PDF download functionality
        downloadBtn.addEventListener('click', () => {
            generatePDF(currentDocumentTitle, summary);
        });
    }
}

// Generate PDF
function generatePDF(title, summary) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Regulatory Summary', 20, 20);
    
    // Add document title
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    const splitTitle = doc.splitTextToSize(title, 170);
    doc.text(splitTitle, 20, 35);
    
    // Add summary
    doc.setFontSize(10);
    const splitSummary = doc.splitTextToSize(summary, 170);
    doc.text(splitSummary, 20, 50);
    
    // Add footer
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text('Generated by InsideDCPulse | insidedcpulse.com', 20, 280);
    
    // Save PDF
    const filename = `Regulatory_Summary_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
}

// Utility Functions
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function showLoading() {
    loadingIndicator.classList.remove('hidden');
    resultsContainer.innerHTML = '';
    emptyState.classList.add('hidden');
}

function hideLoading() {
    loadingIndicator.classList.add('hidden');
}
