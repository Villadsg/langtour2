import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Define conversation message interface
interface ConversationMessage {
  role: string;
  text: string;
  timestamp: string;
}

/**
 * This test records conversations with the AI tour form
 * focused on language learning tours for manual review.
 * 
 * The conversations are saved to the 'conversation-logs' directory
 * in a readable format with timestamps.
 */

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'conversation-logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Helper function to format date for filenames
function getFormattedDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
}

// Helper function to save conversation to file
function saveConversation(testName: string, conversation: ConversationMessage[]) {
  const fileName = `${testName}_${getFormattedDate()}.txt`;
  const filePath = path.join(logsDir, fileName);
  
  let content = `Language Tour Conversation: ${testName}\n`;
  content += `Recorded: ${new Date().toISOString()}\n\n`;
  
  // Filter out debug messages and only keep user and AI messages
  const actualConversation = conversation.filter((message: ConversationMessage) => 
    message.role === 'user' || message.role === 'ai'
  );
  
  if (actualConversation.length === 0) {
    content += "No messages were captured in the conversation.\n";
    console.log("Warning: No messages were captured in the conversation.");
  } else {
    actualConversation.forEach((message, index) => {
      content += `[${message.role.toUpperCase()}]: ${message.text}\n\n`;
    });
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`Conversation saved to: ${filePath}`);
  console.log(`Total messages captured: ${actualConversation.length} (excluding debug messages)`);
  
  // Also save as JSON for potential future use - include all messages for debugging
  const jsonFilePath = path.join(logsDir, `${testName}_${getFormattedDate()}.json`);
  fs.writeFileSync(jsonFilePath, JSON.stringify(conversation, null, 2));
}

test.describe('Language Tour Conversation Recorder', () => {
  test('German business vocabulary tour', async ({ page }) => {
    const testName = 'german_business_tour';
    const conversation: ConversationMessage[] = [];
    
    // Set up listener for messages
    await page.exposeFunction('recordMessage', (role, text) => {
      console.log(`Recording message - Role: ${role}, Text: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
      
      // Special command to clear the conversation array
      if (role === 'clear') {
        console.log('Clearing conversation array');
        conversation.length = 0;
        return;
      }
      
      conversation.push({ role, text, timestamp: new Date().toISOString() });
    });
    
    // Navigate to the tour creation page
    await page.goto('http://localhost:5173/dashboard/create');
    
    // Set up observers for user and AI messages
    await page.evaluate(() => {
      console.log = (message) => {
        // Send console logs to the test runner
        (window as any).recordMessage('debug', message);
      };
      
      // First, capture any existing messages in the chat
      const chatContainer = document.querySelector('.mb-6.max-h-96.overflow-y-auto.p-4.bg-gray-50.rounded-lg');
      console.log('Chat container found: ' + (chatContainer ? 'yes' : 'no'));
      
      if (chatContainer) {
        // Process existing messages
        const messageContainers = chatContainer.querySelectorAll('.mb-4');
        console.log(`Found ${messageContainers.length} existing message containers`);
        
        messageContainers.forEach((container, index) => {
          console.log(`Processing message container ${index}`);
          
          if (container.classList.contains('text-right')) {
            // User message
            const textDiv = container.querySelector('.whitespace-pre-line');
            if (textDiv && textDiv.textContent) {
              console.log(`Found user message: ${textDiv.textContent.substring(0, 30)}...`);
              (window as any).recordMessage('user', textDiv.textContent.trim());
            }
          } else if (container.classList.contains('text-left')) {
            // AI message
            const textDiv = container.querySelector('.whitespace-pre-line');
            if (textDiv && textDiv.textContent) {
              console.log(`Found AI message: ${textDiv.textContent.substring(0, 30)}...`);
              (window as any).recordMessage('ai', textDiv.textContent.trim());
            }
          }
        });

        // Set up observer for new messages
        const observer = new MutationObserver(mutations => {
          console.log(`Mutation observed: ${mutations.length} mutations`);
          
          for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
              console.log(`Added nodes: ${mutation.addedNodes.length}`);
              
              for (const node of mutation.addedNodes) {
                if (node instanceof Element) {
                  console.log(`Added element with classes: ${node.classList ? [...node.classList].join(', ') : 'none'}`);
                  
                  if (node.classList && node.classList.contains('mb-4')) {
                    // Check if it's a user or AI message
                    if (node.classList.contains('text-right')) {
                      // User message
                      const textDiv = node.querySelector('.whitespace-pre-line');
                      if (textDiv && textDiv.textContent) {
                        console.log(`New user message: ${textDiv.textContent.substring(0, 30)}...`);
                        (window as any).recordMessage('user', textDiv.textContent.trim());
                      }
                    } else if (node.classList.contains('text-left')) {
                      // AI message
                      const textDiv = node.querySelector('.whitespace-pre-line');
                      if (textDiv && textDiv.textContent) {
                        console.log(`New AI message: ${textDiv.textContent.substring(0, 30)}...`);
                        (window as any).recordMessage('ai', textDiv.textContent.trim());
                      }
                    }
                  } else {
                    // Check if this element contains message containers
                    const messageContainers = node.querySelectorAll('.mb-4');
                    if (messageContainers.length > 0) {
                      console.log(`Found ${messageContainers.length} message containers in added node`);
                      
                      messageContainers.forEach((container, index) => {
                        if (container.classList.contains('text-right')) {
                          // User message
                          const textDiv = container.querySelector('.whitespace-pre-line');
                          if (textDiv && textDiv.textContent) {
                            console.log(`Found nested user message: ${textDiv.textContent.substring(0, 30)}...`);
                            (window as any).recordMessage('user', textDiv.textContent.trim());
                          }
                        } else if (container.classList.contains('text-left')) {
                          // AI message
                          const textDiv = container.querySelector('.whitespace-pre-line');
                          if (textDiv && textDiv.textContent) {
                            console.log(`Found nested AI message: ${textDiv.textContent.substring(0, 30)}...`);
                            (window as any).recordMessage('ai', textDiv.textContent.trim());
                          }
                        }
                      });
                    }
                  }
                }
              }
            }
          }
        });
        
        // Start observing the chat container
        observer.observe(chatContainer, { childList: true, subtree: true });
        console.log('Observer set up for chat container');
      } else {
        // Try to find the chat container with a different approach
        const possibleContainers = document.querySelectorAll('div');
        console.log(`Found ${possibleContainers.length} divs in total`);
        
        // Look for divs that might be our chat container
        const chatContainers = Array.from(possibleContainers).filter(div => {
          return div.classList && 
                 div.classList.contains('mb-6') && 
                 div.querySelectorAll('.whitespace-pre-line').length > 0;
        });
        
        console.log(`Found ${chatContainers.length} potential chat containers`);
        
        if (chatContainers.length > 0) {
          const container = chatContainers[0];
          console.log(`Using alternative chat container with classes: ${[...container.classList].join(', ')}`);
          
          // Set up the same observer for this container
          const observer = new MutationObserver(mutations => {
            // Similar logic as above
            for (const mutation of mutations) {
              if (mutation.addedNodes.length) {
                for (const node of mutation.addedNodes) {
                  if (node instanceof Element) {
                    // Process the node
                    // Similar logic as above
                  }
                }
              }
            }
          });
          
          observer.observe(container, { childList: true, subtree: true });
          console.log('Observer set up for alternative chat container');
        }
      }
    });
    
    // Wait for the AI form to be visible
    await page.waitForSelector('body > div:nth-child(1) > div.min-h-screen.flex.flex-col > main > div > div > h1', { timeout: 5000 });
    
    // Select location on map
    const mapPicker = await page.locator('.map-container');
    await expect(mapPicker).toBeVisible();
    await mapPicker.click();
    
    // Enter a language tour description
    const chatInput = await page.locator('.flex-grow.shadow.appearance-none.border');
    await chatInput.fill('I want to create a German language tour in Berlin focused on business vocabulary. The tour will be taught in English and is suitable for intermediate (B1) learners. It will include visits to the business district and practice ordering in restaurants.');
    await chatInput.press('Enter');
    
    // Wait for AI response
    await page.waitForSelector('.bg-blue-100.text-blue-800');
    await page.waitForTimeout(5000);
    
    // Continue the conversation with more details
    await chatInput.fill('Yes, the tour will be called "Business German in Berlin" and will focus on formal business greetings, restaurant vocabulary, and numbers.');
    await chatInput.press('Enter');
    
    // Wait for AI to process
    await page.waitForTimeout(5000);
    
    // Ask about specific vocabulary
    await chatInput.fill('The tour will teach vocabulary like "Guten Tag", "Auf Wiedersehen", "die Rechnung, bitte", and business meeting terminology.');
    await chatInput.press('Enter');
    
    // Wait for AI to process
    await page.waitForTimeout(5000);
    
    // Log the conversation state before saving
    console.log(`Conversation before saving: ${conversation.length} messages`);
    conversation.forEach((msg, idx) => {
      console.log(`Message ${idx}: [${msg.role}] ${msg.text.substring(0, 50)}${msg.text.length > 50 ? '...' : ''}`);
    });
    
    // Take a screenshot of the final state
    await page.screenshot({ path: path.join(logsDir, `${testName}_final.png`) });
    
    // Wait a moment to ensure all messages are captured
    await page.waitForTimeout(2000);
    
    // Manually capture messages as a fallback
    await page.evaluate(() => {
      // Clear previous conversation data
      (window as any).recordMessage('clear', 'Clearing previous conversation data');
      
      const chatContainer = document.querySelector('.mb-6.max-h-96.overflow-y-auto.p-4.bg-gray-50.rounded-lg');
      
      if (chatContainer) {
        // Get all message containers in order
        const messageContainers = chatContainer.querySelectorAll('.mb-4');
        console.log(`Manual capture found ${messageContainers.length} total message containers in order`);
        
        // Process them in the order they appear in the DOM (chronological order)
        messageContainers.forEach((container, index) => {
          if (container.classList.contains('text-right')) {
            // User message
            const textDiv = container.querySelector('.whitespace-pre-line');
            if (textDiv && textDiv.textContent) {
              console.log(`Capturing user message ${index}: ${textDiv.textContent.substring(0, 30)}...`);
              (window as any).recordMessage('user', textDiv.textContent.trim());
            }
          } else if (container.classList.contains('text-left')) {
            // AI message
            const textDiv = container.querySelector('.whitespace-pre-line');
            if (textDiv && textDiv.textContent) {
              console.log(`Capturing AI message ${index}: ${textDiv.textContent.substring(0, 30)}...`);
              (window as any).recordMessage('ai', textDiv.textContent.trim());
            }
          }
        });
      }
    });
    
    // Wait a moment for the final messages to be recorded
    await page.waitForTimeout(1000);
    
    // Save the conversation
    saveConversation(testName, conversation);
    
    // Also save HTML of the chat for debugging
    const chatHtml = await page.evaluate(() => {
      const chatContainer = document.querySelector('.mb-6.max-h-96.overflow-y-auto.p-4.bg-gray-50.rounded-lg');
      return chatContainer ? chatContainer.outerHTML : 'Chat container not found';
    });
    
    const htmlFilePath = path.join(logsDir, `${testName}_chat_html_${getFormattedDate()}.html`);
    fs.writeFileSync(htmlFilePath, chatHtml);
    console.log(`Chat HTML saved to: ${htmlFilePath}`);
    
    // Take another screenshot of the final state
    await page.screenshot({ path: path.join(logsDir, `${testName}_final_after_save.png`) });
  });
  
  
  
 
});
