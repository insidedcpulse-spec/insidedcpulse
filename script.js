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

// Main Search Function (Refactored to use backend proxy)
async function performSearch(query) {
    if (!query || query.trim() === '') {
        alert('Please enter a search term');
        return;
    }

    showLoading();
    
    try {
                    const response = await fetch('/api/gov-proxy', {            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            throw new Error(`Search failed with status: ${response.status}`);
        }

        const data = await response.json();
        displayResults(data.results);

    } catch (error) {
        console.error('Search error:', error);
        alert('An error occurred while searching. Please try again.');
        hideLoading(); // Ensure loading is hidden on error
    } finally {
        // displayResults will hide loading, but we do it here for safety
        hideLoading();
    }
}

// Display Results
function displayResults(results) {
    resultsContainer.innerHTML = '';
    emptyState.classList.add('hidden');

    if (!results || results.length === 0) {
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
            <span class="px-3 py-1 ${typeColors[result.type] || 'bg-gray-100 text-gray-800'} text-xs font-semibold rounded-full">
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
    
    const generateBtn = card.querySelector('.generate-summary-btn');
    generateBtn.addEventListener('click', () => {
        currentDocumentText = result.fullText;
        currentDocumentTitle = result.title;
        emailModal.classList.remove('hidden');
        
        generateBtn.dataset.cardId = Math.random().toString(36).substring(7);
        card.dataset.cardId = generateBtn.dataset.cardId;
    });
    
    return card;
}

// Handle Email Submit
async function handleEmailSubmit() {
    const email = emailInput.value.trim();
    
    if (!email) {
        alert('Please enter a valid email address');
        return;
    }
    
    try {
        await saveLeadToSupabase(email);
        
        const summary = await generateAISummary(currentDocumentText);
        
        displaySummary(summary);
        
        emailModal.classList.add('hidden');
        emailInput.value = '';
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred. Please try again.');
    }
}

// Save Lead to Supabase (Refactored to remove CONFIG)
async function saveLeadToSupabase(email) {
    const supabaseUrl = 'https://qfmxuqvpgqnuqvdvjfzk.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmbXh1cXZwZ3FudXF2ZHZqZnprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0ODY5NzQsImV4cCI6MjA3NTA2Mjk3NH0.tHbvGQXLqRqvX8_GxUlVvZlqQGT7R7lLXPVUQR2qN9A';

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/leads`, {
            method: 'POST',
            headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${supabaseAnonKey}`,
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

// Generate AI Summary with Gemini via Backend Proxy
async function generateAISummary(text) {
    try {
        const response = await fetch('/api/gemini-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        
        const data = await response.json();
        
        if (response.ok && data.summary) {
            return data.summary;
        } else {
            console.error("Backend proxy error:", data);
            return `AI Summary temporarily unavailable. Here's the document excerpt:\n\n${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`;
        }
    } catch (error) {
        console.error('Backend proxy error:', error);
        return `AI Summary temporarily unavailable. Here's the document excerpt:\n\n${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`;
    }
}

// Display Summary
function displaySummary(summary) {
    const cards = document.querySelectorAll('.result-card');
    const lastCard = Array.from(cards).find(c => c.dataset.cardId);
    
    if (lastCard) {
        const summaryContainer = lastCard.querySelector('.summary-container');
        const summaryText = lastCard.querySelector('.summary-text');
        const downloadBtn = lastCard.querySelector('.download-pdf-btn');
        
        summaryText.textContent = summary;
        summaryContainer.classList.remove('hidden');
        
        downloadBtn.addEventListener('click', () => {
            generatePDF(currentDocumentTitle, summary);
        });

        delete lastCard.dataset.cardId;
    }
}

// Generate PDF
function generatePDF(title, summary) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Regulatory Summary', 20, 20);
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    const splitTitle = doc.splitTextToSize(title, 170);
    doc.text(splitTitle, 20, 35);
    
    doc.setFontSize(10);
    const splitSummary = doc.splitTextToSize(summary, 170);
    doc.text(splitSummary, 20, 50);
    
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text('Generated by InsideDCPulse | insidedcpulse.com', 20, 280);
    
    const filename = `Regulatory_Summary_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
}

// Utility Functions
function validateEmail(email) {
    const re = /^[^S@]+@[^S@]+S[^S@]+$/;
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