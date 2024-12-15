// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

const OPENAI_API_KEY = 'YOUR KEY HERE';

const fileInput = document.getElementById('pdfInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const clearFileBtn = document.getElementById('clearFile');
const loadingIndicator = document.getElementById('loadingIndicator');
const definitionPopup = document.getElementById('definitionPopup');
const definitionText = document.getElementById('definitionText');
const closeDefinition = document.getElementById('closeDefinition');

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        fileName.textContent = file.name;
        fileInfo.classList.remove('hidden');
    }
});

clearFileBtn.addEventListener('click', () => {
    fileInput.value = '';
    fileInfo.classList.add('hidden');
    document.getElementById('originalContent').innerHTML = '';
    document.getElementById('simplifiedContent').innerHTML = '';
});

document.getElementById('uploadBtn').addEventListener('click', async () => {
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a PDF file first.');
        return;
    }

    try {
        loadingIndicator.classList.remove('hidden');
        const text = await extractTextFromPDF(file);
        const sections = splitIntoSections(text);
        displayOriginalText(sections);
        
        // Simplify each section
        for (const section of sections) {
            try {
                const simplified = await simplifyText(section);
                appendSimplifiedText(simplified);
            } catch (error) {
                console.error('Error simplifying section:', error);
                appendSimplifiedText(`Error simplifying text: ${error.message}`);
            }
        }
    } catch (error) {
        console.error('Error processing PDF:', error);
        alert('Error processing PDF file: ' + error.message);
    } finally {
        loadingIndicator.classList.add('hidden');
    }
});

async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
    }
    
    return fullText;
}

function splitIntoSections(text) {
    // Simple section splitting by paragraphs
    return text.split('\n\n').filter(section => section.trim().length > 0);
}

function attachSelectionListeners() {
    const originalContent = document.getElementById('originalContent');
    const simplifiedContent = document.getElementById('simplifiedContent');

    [originalContent, simplifiedContent].forEach(container => {
        container.addEventListener('mouseup', async () => {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();
            
            if (selectedText.length > 0) {
                try {
                    definitionText.innerHTML = 'Loading...';
                    definitionPopup.classList.remove('hidden');
                    
                    const definition = await getDefinition(selectedText);
                    definitionText.innerHTML = definition;
                } catch (error) {
                    definitionText.innerHTML = 'Error getting definition. Please try again.';
                    console.error('Definition error:', error);
                }
            }
        });
    });
}

function displayOriginalText(sections) {
    const originalContent = document.getElementById('originalContent');
    originalContent.innerHTML = sections.map(section => `<p>${section}</p>`).join('');
    attachSelectionListeners();
}

async function simplifyText(text) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{
                    role: "user",
                    content: `Please rewrite the following text in a very simple, easy-to-read format. Use these guidelines:
                    - Use everyday language that a middle school student could understand
                    - Break down complex ideas into short, simple sentences
                    - Add line breaks between different ideas
                    - Use bullet points for lists or key points
                    - Add clear headings for different sections
                    - Explain any technical terms in simple words
                    - If there is a figure in the text, please explain clearly what is being shown in the figure.
                    
                    Here's the text to simplify:
                    ${text}`
                }],
                temperature: 0.7,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error:', errorData);
            throw new Error(`API error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('API Response:', data);  // Debug the response

        if (!data.choices || data.choices.length === 0) {
            throw new Error('No response from API');
        }

        return data.choices[0].message.content;
    } catch (error) {
        console.error('Error in simplifyText:', error);
        throw error;
    }
}

function appendSimplifiedText(text) {
    const simplifiedContent = document.getElementById('simplifiedContent');
    const paragraph = document.createElement('div');
    paragraph.innerHTML = text.replace(/\n/g, '<br>');
    simplifiedContent.appendChild(paragraph);
    attachSelectionListeners();
}

closeDefinition.addEventListener('click', () => {
    definitionPopup.classList.add('hidden');
});

async function getDefinition(word) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{
                    role: "user",
                    content: `Please provide a clear and concise definition for the word or phrase "${word}". If it's a technical or scientific term, please include both a technical definition and a simpler explanation. Format the response with HTML if needed for better readability.`
                }],
                temperature: 0.7,
                max_tokens: 200
            })
        });

        if (!response.ok) {
            throw new Error('Failed to get definition');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('Error getting definition:', error);
        throw error;
    }
}

document.addEventListener('click', (e) => {
    if (!definitionPopup.contains(e.target) && 
        !e.target.closest('.content-box')) {
        definitionPopup.classList.add('hidden');
    }
});

attachSelectionListeners();
