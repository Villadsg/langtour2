// Gemini AI service for the tour creation form
// This service handles the interaction with Google's Gemini AI API

// Store the API key securely
let GEMINI_API_KEY: string = '';

// Load the API key from environment variables
try {
  // For testing only - try to use the environment variable from window.ENV
  if (typeof window !== 'undefined' && (window as any).ENV && (window as any).ENV.PUBLIC_GEMINI_API_KEY) {
    GEMINI_API_KEY = (window as any).ENV.PUBLIC_GEMINI_API_KEY;
    console.log('Gemini API key loaded from window.ENV');
  }
  // Standard SvelteKit approach for PUBLIC_ prefixed env vars
  else if (import.meta.env && import.meta.env.PUBLIC_GEMINI_API_KEY) {
    GEMINI_API_KEY = import.meta.env.PUBLIC_GEMINI_API_KEY;
    console.log('Gemini API key loaded from import.meta.env');
  }
  // Add additional debug logging to help troubleshoot
  else {
    console.log('Available environment variables:', Object.keys(import.meta.env).filter(key => key.startsWith('PUBLIC_')));
  }

  // Verify the API key is available
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key is not available in environment variables.');
    console.error('Please ensure PUBLIC_GEMINI_API_KEY is defined in your .env file.');
  }
} catch (e) {
  console.error('Error loading Gemini API key:', e);
  console.warn('Please check your environment configuration.');
}

// Define the response type from Gemini AI
interface GeminiResponse {
  response: string;
  feedback?: string;
}

// Helper for rate limiting and retries
const callWithRetry = async (apiCall: () => Promise<any>, maxRetries: number = 3, initialDelay: number = 1000): Promise<any> => {
  let retries = 0;
  let delay = initialDelay;
  
  while (true) {
    try {
      return await apiCall();
    } catch (error: any) {
      // Check if this is a rate limit error (429)
      if (error.message && error.message.includes('429') && retries < maxRetries) {
        console.log(`Rate limited, retrying in ${delay}ms (attempt ${retries + 1}/${maxRetries})...`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Exponential backoff
        retries++;
        delay *= 2;
      } else {
        // Either not a rate limit error or we've exceeded max retries
        throw error;
      }
    }
  }
};

export const GeminiService = {
  // Function to correct spelling and grammar in text
  async correctText(text: string): Promise<string> {
    return callWithRetry(async () => {
      try {
        const prompt = `Correct any spelling mistakes and grammatical errors in the following text.
        Maintain the original meaning and style, but fix any issues with language.
        Only return the corrected text, with no explanations or comments.
        
        Text: ${text}`;
        
        // API request to Gemini using v1beta and gemini-2.0-flash model
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt }
                ]
              }
            ]
          })
        });
        
        if (!response.ok) {
          console.error(`Gemini API error status: ${response.status}`);
          let errorMessage = 'Unknown error';
          
          try {
            const errorData = await response.json();
            errorMessage = errorData.error?.message || 'API error';
          } catch (jsonError) {
            try {
              const errorText = await response.text();
              errorMessage = `API returned non-JSON response: ${errorText.substring(0, 100)}`;
            } catch (textError) {
              errorMessage = `API error (${response.status})`;
            }
          }
          
          throw new Error(`Gemini API error: ${errorMessage}`);
        }
        
        const data = await response.json();
        
        // Handle the response format
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
          const parts = data.candidates[0].content.parts;
          if (parts && parts.length > 0) {
            return parts[0].text || text;
          }
        }
        
        console.error('Unexpected Gemini API response format:', data);
        return text; // Return original text if response format is unexpected
      } catch (error) {
        console.error('Error correcting text:', error);
        return text; // Return original text if correction fails
      }
    }, 3, 500);
  },
  
  // Function to generate suggestions for missing tour information
  async generateSuggestions(description: string, missingFields: string[]): Promise<Record<string, string>> {
    return callWithRetry(async () => {
      try {
        const fieldsPrompt = missingFields.join(', ');
        const prompt = `You are a helpful assistant for a language learning tour platform. 
        Based on the following tour description, suggest appropriate values for the missing fields. 
        Be creative, catchy and realistic. For names, create something neutral that captures the essence of the tour.
       
        A complete language tour should include:
        - A specific language learning element or vocabulary subject
        - Clear information about which language to learn, in which city, and prerequisite language knowledge
        - At least two specific spots or locations to visit
        - The expected duration of the tour
        - The language difficulty level (e.g., A1, A2, B1, B2, C1, C2)
        
        Only respond with the suggested values in a simple format, no explanations needed.
        
        Tour description: "${description}"
        
        Please suggest values for: ${fieldsPrompt}`;
        
        // API request to Gemini using v1beta and gemini-2.0-flash model
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt }
                ]
              }
            ]
          })
        });
        
        if (!response.ok) {
          console.error(`Gemini API error status: ${response.status}`);
          let errorMessage = 'Unknown error';
          
          try {
            const errorData = await response.json();
            errorMessage = errorData.error?.message || 'API error';
          } catch (jsonError) {
            try {
              const errorText = await response.text();
              errorMessage = `API returned non-JSON response: ${errorText.substring(0, 100)}`;
            } catch (textError) {
              errorMessage = `API error (${response.status})`;
            }
          }
          
          throw new Error(`Gemini API error: ${errorMessage}`);
        }
        
        const data = await response.json();
        
        // Handle the response format
        let aiResponse = '';
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
          const parts = data.candidates[0].content.parts;
          if (parts && parts.length > 0) {
            aiResponse = parts[0].text || '';
          }
        }
        
        if (!aiResponse) {
          console.error('Unexpected Gemini API response format:', data);
          return {}; // Return empty object if response format is unexpected
        }
        
        // Parse the response to extract suggestions
        const suggestions: Record<string, string> = {};
        
        // Handle different response formats
        missingFields.forEach(field => {
          const fieldLower = field.toLowerCase();
          const regex = new RegExp(`${fieldLower}[:\\s]+([^\\n]+)`, 'i');
          const match = aiResponse.match(regex);
          
          if (match && match[1]) {
            suggestions[field] = match[1].trim();
          } else {
            // Try to find the field in the response without a specific format
            const lines = aiResponse.split('\\n').filter((line: string) => line.toLowerCase().includes(fieldLower));
            if (lines.length > 0) {
              const valuePart = lines[0].split(':')[1] || lines[0].split('-')[1] || lines[0];
              suggestions[field] = valuePart ? valuePart.trim() : '';
            }
          }
        });
        
        return suggestions;
      } catch (error) {
        console.error('Error generating suggestions:', error);
        return {}; // Return empty object if suggestions fail
      }
    }, 3, 500);
  },
  
  // Function to analyze a tour description and provide feedback
  async analyzeTourDescription(description: string): Promise<GeminiResponse> {
    return callWithRetry(async () => {
      try {
        const prompt = `You are a helpful assistant for a language learning tour platform.
        Analyze the following tour description and provide feedback on its quality based on these essential components:

        1. A specific language learning element or vocabulary subject
        2. Clear information about which language to learn, in which city, and any prerequisite language knowledge
        3. At least two specific spots or locations to visit during the tour
        4. The expected duration of the tour
        5. The language difficulty level (e.g., A1, A2, B1, B2, C1, C2)

        List each component as either present or missing, then provide an overall feedback category.
        
        Tour description: "${description}"
        
        Format your response as:
        MISSING COMPONENTS: [list any missing components from the numbered list above]
        Feedback: [excellent/good/needs_improvement]
        Explanation: [brief explanation that suggests how to improve any missing components]`;
        
        // API request to Gemini using v1beta and gemini-2.0-flash model
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt }
                ]
              }
            ]
          })
        });
        
        if (!response.ok) {
          console.error(`Gemini API error status: ${response.status}`);
          let errorMessage = 'Unknown error';
          
          try {
            const errorData = await response.json();
            errorMessage = errorData.error?.message || 'API error';
          } catch (jsonError) {
            try {
              const errorText = await response.text();
              errorMessage = `API returned non-JSON response: ${errorText.substring(0, 100)}`;
            } catch (textError) {
              errorMessage = `API error (${response.status})`;
            }
          }
          
          throw new Error(`Gemini API error: ${errorMessage}`);
        }
        
        const data = await response.json();
        
        // Handle the response format
        let aiResponse = '';
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
          const parts = data.candidates[0].content.parts;
          if (parts && parts.length > 0) {
            aiResponse = parts[0].text || '';
          }
        }
        
        if (!aiResponse) {
          console.error('Unexpected Gemini API response format:', data);
          return {
            response: 'Unable to analyze the description at this time.',
            feedback: 'good' // Default to neutral feedback
          };
        }
        
        // Parse the response to extract feedback
        let feedback = 'good'; // Default feedback
        let explanation = '';
        
        const feedbackMatch = aiResponse.match(/Feedback:\\s*(excellent|good|needs_improvement)/i);
        if (feedbackMatch) {
          feedback = feedbackMatch[1].toLowerCase();
        }
        
        const explanationMatch = aiResponse.match(/Explanation:\\s*(.+?)(?:\\n|$)/is);
        if (explanationMatch) {
          explanation = explanationMatch[1].trim();
        } else {
          // If no explanation format is found, use the whole response
          explanation = aiResponse.trim();
        }
        
        return {
          response: explanation,
          feedback: feedback
        };
      } catch (error) {
        console.error('Error analyzing tour description:', error);
        return {
          response: 'Unable to analyze the description at this time.',
          feedback: 'good' // Default to neutral feedback
        };
      }
    }, 3, 500);
  }
};
