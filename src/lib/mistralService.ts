// Mistral AI service for the tour creation form
// This service handles the interaction with Mistral AI API
// Try to import from environment, but provide fallback for build process
let MISTRAL_API_KEY: string;

try {
  // Import from SvelteKit environment
  MISTRAL_API_KEY = import.meta.env.PUBLIC_MISTRAL_API_KEY || '';
} catch (e) {
  // Fallback for build process
  MISTRAL_API_KEY = '';
  console.warn('Mistral API key not found in environment variables');
}

// Define the response type from Mistral AI
interface MistralResponse {
  response: string;
  feedback?: string;
}

export const MistralService = {
  // Function to correct spelling and grammar in text
  async correctText(text: string): Promise<string> {
    try {
      const systemMessage = `You are a helpful text editor. 
      Correct any spelling mistakes and grammatical errors in the following text.
      Maintain the original meaning and style, but fix any issues with language.
      Only return the corrected text, with no explanations or comments.`;
      
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MISTRAL_API_KEY}`
        },
        body: JSON.stringify({
          model: "mistral-medium",
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: text }
          ],
          temperature: 0.3, // Lower temperature for more accurate corrections
          max_tokens: 500
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Mistral API error: ${errorData.error?.message || 'Unknown error'}`);
      }
      
      const data = await response.json();
      const correctedText = data.choices[0].message.content;
      
      return correctedText;
    } catch (error) {
      console.error('Error correcting text:', error);
      return text; // Return original text if correction fails
    }
  },
  // Function to generate suggestions for missing tour information
  async generateSuggestions(description: string, missingFields: string[]): Promise<Record<string, string>> {
    try {
      const systemMessage = `You are a helpful assistant for a language learning tour platform. 
      Based on the following tour description, suggest appropriate values for the missing fields. 
      Be creative, catchy and realistic. For names, create something memorable and specific that captures the essence of the tour.
      For example, if it's about buildings that survived fires in Copenhagen, suggest "Copenhagen's Phoenix Buildings" or "Rising from Ashes: Copenhagen's Resilient Architecture".
      Only respond with the suggested values in a simple format, no explanations needed.`;
      
      const fieldsPrompt = missingFields.join(', ');
      const userPrompt = `Tour description: "${description}"

Please suggest values for: ${fieldsPrompt}`;
      
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MISTRAL_API_KEY}`
        },
        body: JSON.stringify({
          model: "mistral-medium",
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 300
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Mistral API error: ${errorData.error?.message || 'Unknown error'}`);
      }
      
      const data = await response.json();
      const aiResponse = data.choices[0].message.content;
      
      // Parse the response to extract suggestions
      const suggestions: Record<string, string> = {};
      
      // Handle different response formats
      missingFields.forEach(field => {
        const fieldLower = field.toLowerCase();
        const regex = new RegExp(`${fieldLower}[:\s]+([^\n]+)`, 'i');
        const match = aiResponse.match(regex);
        
        if (match && match[1]) {
          suggestions[field] = match[1].trim();
        } else {
          // Try to find the field in the response without a specific format
          const lines = aiResponse.split('\n').filter((line: string) => line.toLowerCase().includes(fieldLower));
          if (lines.length > 0) {
            const valuePart = lines[0].split(':')[1] || lines[0].split('-')[1] || lines[0];
            suggestions[field] = valuePart.trim();
          }
        }
      });
      
      return suggestions;
    } catch (error) {
      console.error('Error generating suggestions:', error);
      return {};
    }
  },
  // Function to send a message to Mistral AI and get a response
  async sendMessage(message: string, context: string = ''): Promise<MistralResponse> {
    try {
      // Create a simplified system message for a single-prompt tour creation
      let systemMessage = "Be concise and friendly. Your goal is to help the user create an engaging language tour. ";
      systemMessage += "Ask the user to give a description of the language learning tour, including a name for the tour and which language or languages will be learned.";
      
      // If this is a response to the user's description, evaluate it
      if (context.includes('tour_description')) {
        systemMessage = "Be concise and simply suggest improvements";
      }
      
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MISTRAL_API_KEY}`
        },
        body: JSON.stringify({
          model: "mistral-medium",
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: context + "\n" + message }
          ],
          temperature: 0.7,
          max_tokens: 300
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Mistral API error: ${errorData.error?.message || 'Unknown error'}`); 
      }
      
      const data = await response.json();
      const aiResponse = data.choices[0].message.content;
      
      // Parse feedback from the response if context includes description
      let feedback = undefined;
      if (context.includes('description')) {
        const descriptionLength = message.length;
        if (descriptionLength < 50) {
          feedback = "needs_improvement";
        } else if (descriptionLength < 150) {
          feedback = "good";
        } else {
          feedback = "excellent";
        }
      }
      
      return { response: aiResponse, feedback };
    } catch (error) {
      console.error('Error communicating with Mistral AI:', error);
      return { response: "Sorry, I encountered an error. Please try again." };
    }
  },

  
  // Function to analyze a tour description and provide feedback
  async analyzeTourDescription(description: string): Promise<MistralResponse> {
    try {
      if (!description || description.trim().length === 0) {
        return {
          response: "Please provide a description for your tour.",
          feedback: "empty"
        };
      }
      
      // Create a system message for analyzing the description
      const systemMessage = `You are an expert tour guide and language teacher. 
      Analyze the following tour description and provide constructive feedback. 
      Focus on whether it effectively communicates the language learning aspects and unique experiences. 
      Be specific, helpful, and concise in your feedback. 
      The description length is ${description.length} characters.
      
      If the description is under 100 characters, suggest adding more details about language learning opportunities and unique experiences. Return 'needs_improvement' as feedback.
      If the description is between 100-200 characters or lacks language learning keywords, suggest enhancements. Return 'good' as feedback.
      If the description is over 200 characters and includes language learning aspects, praise it. Return 'excellent' as feedback.`;
      
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MISTRAL_API_KEY}`
        },
        body: JSON.stringify({
          model: "mistral-medium",
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: description }
          ],
          temperature: 0.7,
          max_tokens: 300
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Mistral API error: ${errorData.error?.message || 'Unknown error'}`); 
      }
      
      const data = await response.json();
      const aiResponse = data.choices[0].message.content;
      
      // Determine feedback based on description length and content
      let feedback;
      const descriptionLength = description.length;
      const hasKeywords = /language|learn|experience|unique|explore/i.test(description);
      
      if (descriptionLength < 100) {
        feedback = "needs_improvement";
      } else if (descriptionLength < 200 || !hasKeywords) {
        feedback = "good";
      } else {
        feedback = "excellent";
      }
      
      return {
        response: aiResponse,
        feedback: feedback
      };
    } catch (error) {
      console.error('Error analyzing tour description:', error);
      return { 
        response: "Sorry, I couldn't analyze your description. Please try again.",
        feedback: "error"
      };
    }
  }
};
