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
  // Simple function to get a response from Gemini
  async getResponse(prompt: string): Promise<string> {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key is not configured');
    }

    return callWithRetry(async () => {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: prompt
                }]
              }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 500,
              }
            })
          }
        );

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Gemini API error: ${response.status} - ${errorData}`);
        }

        const data = await response.json();
        
        if (!data.candidates || data.candidates.length === 0) {
          throw new Error('No response from Gemini AI');
        }

        return data.candidates[0].content.parts[0].text;
      } catch (error) {
        console.error('Error calling Gemini API:', error);
        throw error;
      }
    });
  },
  // Function to generate a contextual follow-up question based on missing information
  async generateFollowUpQuestion(currentDescription: string, providedInfo: {
    name?: string,
    cityId?: string,
    language?: string,
    langDifficulty?: string,
    tourType?: string,
    cityAvailable?: boolean
  }): Promise<string> {
    return callWithRetry(async () => {
      try {
        // Prepare a comprehensive prompt that includes what we have and what we need
        const prompt = `You are a helpful assistant for a language tour creation platform. I need you to generate ONE follow-up question to gather missing information for a language learning tour.

A complete language tour description should include:
• A specific vocabulary focus or language learning element
• Which language to learn and in which language it is taught
• At least one specific spot to visit during the tour
• Expected tour duration
• Language difficulty level (A1, A2, B1, B2, C1, C2)

Here's what the user has told us so far: "${currentDescription}"

The user has also provided these specific details:
${providedInfo.name ? `• Tour name: ${providedInfo.name}` : '• Tour name: Not provided yet'}
${providedInfo.cityId || providedInfo.cityAvailable ? `• City: ${providedInfo.cityId || 'Will be selected on map'}` : '• City: Not provided yet'}
${providedInfo.language ? `• Language pair: ${providedInfo.language}` : '• Language pair: Not provided yet'}
${providedInfo.langDifficulty ? `• Difficulty level: ${providedInfo.langDifficulty}` : '• Difficulty level: Not provided yet'}
${providedInfo.tourType ? `• Tour type: ${providedInfo.tourType}` : '• Tour type: Not provided yet'}

Based on this information, ask ONE natural, conversational follow-up question to get the MOST IMPORTANT missing information. Do not ask about multiple things at once. Focus on only the most critical missing element. Be specific and friendly.

Reply with just the question text, without any additional explanation or preamble.`;
        
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
        
        // If no valid response, return a default question
        if (!aiResponse) {
          console.error('Unexpected Gemini API response format:', data);
          
          // Return a default question based on missing info
          if (!providedInfo.language) {
            return 'Which language would you like to learn during this tour, and in what language would you prefer the tour to be taught?';
          } else if (!providedInfo.cityId) {
            return 'In which city would you like this tour to take place?';
          } else if (!providedInfo.langDifficulty) {
            return 'What language difficulty level is this tour designed for (A1, A2, B1, B2, C1, C2)?';
          } else {
            return 'Could you tell me more about the specific vocabulary or language elements that will be taught on this tour?';
          }
        }
        
        return aiResponse;
      } catch (error) {
        console.error('Error generating follow-up question:', error);
        return 'Could you provide more details about your language learning tour?';
      }
    }, 3, 500);
  },
  
  // Function to create a cohesive description from collected information
  async createCohesiveDescription(collectedInfo: {
    name?: string,
    cityId?: string,
    language?: string,
    langDifficulty?: string,
    tourType?: string,
    userResponses: string[]
  }): Promise<string> {
    return callWithRetry(async () => {
      try {
        // Join all user responses with clear separators
        const userInput = collectedInfo.userResponses.join('\n\n');
        
        const prompt = `You are a helpful assistant for a language tour creation platform. Based on the following information, craft a cohesive, natural-sounding tour description that highlights all the important aspects of this language learning tour.

Here's the information collected from the user's responses:
"${userInput}"

Additional details provided:
${collectedInfo.name ? `• Tour name: ${collectedInfo.name}` : ''}
${collectedInfo.cityId ? `• City: ${collectedInfo.cityId}` : ''}
${collectedInfo.language ? `• Language pair: ${collectedInfo.language}` : ''}
${collectedInfo.langDifficulty ? `• Difficulty level: ${collectedInfo.langDifficulty}` : ''}
${collectedInfo.tourType ? `• Tour type: ${collectedInfo.tourType}` : ''}

Make sure the description includes:
• The language being learned and in which language the tour is conducted
• The city/location of the tour
• Specific vocabulary focus or language elements taught
• At least one specific spot or location that will be visited
• Expected duration of the tour
• Language difficulty level

Write a flowing, engaging paragraph (or two) that reads naturally, as if written by a professional tour guide. Avoid bullet points or listing format. Keep the description informative but concise, around 100-150 words.

Description:`;
        
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
          return userInput; // Return the original input if we can't generate a cohesive description
        }
        
        return aiResponse;
      } catch (error) {
        console.error('Error creating cohesive description:', error);
        return collectedInfo.userResponses.join('\n\n'); // Return original inputs on error
      }
    }, 3, 500);
  },
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
