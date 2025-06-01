import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

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
function saveConversation(testName, conversation) {
  const fileName = `${testName}_${getFormattedDate()}.txt`;
  const filePath = path.join(logsDir, fileName);
  
  let content = `Language Tour Conversation: ${testName}\n`;
  content += `Recorded: ${new Date().toISOString()}\n\n`;
  
  conversation.forEach((message, index) => {
    content += `[${message.role.toUpperCase()}]: ${message.text}\n\n`;
  });
  
  fs.writeFileSync(filePath, content);
  console.log(`Conversation saved to: ${filePath}`);
  
  // Also save as JSON for potential future use
  const jsonFilePath = path.join(logsDir, `${testName}_${getFormattedDate()}.json`);
  fs.writeFileSync(jsonFilePath, JSON.stringify(conversation, null, 2));
}

test.describe('Language Tour Conversation Recorder', () => {
  test('German business vocabulary tour', async ({ page }) => {
    const testName = 'german_business_tour';
    const conversation = [];
    
    // Set up listener for messages
    await page.exposeFunction('recordMessage', (role, text) => {
      conversation.push({ role, text, timestamp: new Date().toISOString() });
    });
    
    // Navigate to the tour creation page
    await page.goto('http://localhost:5173/dashboard/create');
    
    // Set up observers for user and AI messages
    await page.evaluate(() => {
      const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
          if (mutation.addedNodes.length) {
            for (const node of mutation.addedNodes) {
              if (node.classList?.contains('user-message')) {
                const text = node.textContent;
                window.recordMessage('user', text);
              } else if (node.classList?.contains('ai-message')) {
                const text = node.textContent;
                window.recordMessage('ai', text);
              }
            }
          }
        }
      });
      
      // Start observing the chat container
      const chatContainer = document.querySelector('.chat-container');
      if (chatContainer) {
        observer.observe(chatContainer, { childList: true, subtree: true });
      }
    });
    
    // Wait for the AI form to be visible
    await page.waitForSelector('body > div:nth-child(1) > div.min-h-screen.flex.flex-col > main > div > div > h1', { timeout: 5000 });
    
    // Select location on map
    const mapPicker = await page.locator('.map-container');
    await expect(mapPicker).toBeVisible();
    await mapPicker.click();
    
    // Enter a language tour description
    const chatInput = await page.locator('textarea[placeholder="Type the tour description here..."]');
    await chatInput.fill('I want to create a German language tour in Berlin focused on business vocabulary. The tour will be taught in English and is suitable for intermediate (B1) learners. It will include visits to the business district and practice ordering in restaurants.');
    await chatInput.press('Enter');
    
    // Wait for AI response
    await page.waitForSelector('.ai-message:has-text("German")');
    await page.waitForTimeout(1000);
    
    // Continue the conversation with more details
    await chatInput.fill('Yes, the tour will be called "Business German in Berlin" and will focus on formal business greetings, restaurant vocabulary, and numbers.');
    await chatInput.press('Enter');
    
    // Wait for AI to process
    await page.waitForTimeout(2000);
    
    // Ask about specific vocabulary
    await chatInput.fill('The tour will teach vocabulary like "Guten Tag", "Auf Wiedersehen", "die Rechnung, bitte", and business meeting terminology.');
    await chatInput.press('Enter');
    
    // Wait for AI to process
    await page.waitForTimeout(2000);
    
    // Save the conversation
    saveConversation(testName, conversation);
    
    // Take a screenshot of the final state
    await page.screenshot({ path: path.join(logsDir, `${testName}_final.png`) });
  });
  
  
  
 
});
