# Test info

- Name: Language Tour Conversation Recorder >> German business vocabulary tour
- Location: /home/villadsg/Documents/GitHub/langtour2/tests/language-tour-conversation-recorder.spec.ts:46:3

# Error details

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('textarea[placeholder="Type the tour description here..."]')

    at /home/villadsg/Documents/GitHub/langtour2/tests/language-tour-conversation-recorder.spec.ts:93:21
```

# Page snapshot

```yaml
- navigation:
  - link "LangTour":
    - /url: /
  - link "Book a tour":
    - /url: /
  - link "Create a tour":
    - /url: /dashboard/create
  - link "Login":
    - /url: /login
  - link "Sign Up":
    - /url: /signup
- main:
  - link "Back to Dashboard":
    - /url: /dashboard
    - img
    - text: Back to Dashboard
  - heading "Create New Tour" [level=1]
  - heading "Select Tour Starting Point" [level=3]
  - paragraph: Use the map to select the location for your tour.
  - textbox "Search for a location"
  - button "Keyboard shortcuts"
  - region "Map"
  - button "Map camera controls"
  - link "Open this area in Google Maps (opens a new window)":
    - /url: https://maps.google.com/maps?ll=40.7128,-74.006&z=13&t=m&hl=en-US&gl=US&mapclient=apiv3
    - img "Google"
  - button "Keyboard shortcuts"
  - text: Map data ©2025 Google
  - link "Terms":
    - /url: https://www.google.com/intl/en-US_US/help/terms_maps.html
  - link "Report a map error":
    - /url: https://www.google.com/maps/@40.7128,-74.006,13z/data=!10m1!1e1!12b1?source=apiv3&rapsrc=apiv3
  - heading "Describe Your Tour" [level=3]
  - paragraph: Tell us about your language learning tour and we'll help you create it.
  - text: Hello! Please describe your language learning tour plan, target language, difficulty level (A1-C2), and other details.
  - textbox "Type the tour description here..."
  - button "Send" [disabled]
  - button "Create Tour" [disabled]
  - button "Cancel"
- contentinfo:
  - heading "LangTour" [level=3]
  - paragraph: Connecting language learners with authentic cultural experiences through immersive guided tours.
  - heading "Resources" [level=3]
  - list:
    - listitem:
      - link "About Us":
        - /url: /about
    - listitem:
      - link "FAQ":
        - /url: /faq
    - listitem:
      - link "Become a Guide":
        - /url: /become-guide
  - heading "Legal" [level=3]
  - list:
    - listitem:
      - link "Terms of Service":
        - /url: /terms
    - listitem:
      - link "Privacy Policy":
        - /url: /privacy
    - listitem:
      - link "Contact Us":
        - /url: /contact
  - paragraph: © 2025 LangTour. All rights reserved.
  - link "Twitter":
    - /url: https://twitter.com
  - link "Facebook":
    - /url: https://facebook.com
  - link "Instagram":
    - /url: https://instagram.com
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 | import * as fs from 'fs';
   3 | import * as path from 'path';
   4 |
   5 | /**
   6 |  * This test records conversations with the AI tour form
   7 |  * focused on language learning tours for manual review.
   8 |  * 
   9 |  * The conversations are saved to the 'conversation-logs' directory
   10 |  * in a readable format with timestamps.
   11 |  */
   12 |
   13 | // Create logs directory if it doesn't exist
   14 | const logsDir = path.join(process.cwd(), 'conversation-logs');
   15 | if (!fs.existsSync(logsDir)) {
   16 |   fs.mkdirSync(logsDir, { recursive: true });
   17 | }
   18 |
   19 | // Helper function to format date for filenames
   20 | function getFormattedDate() {
   21 |   const now = new Date();
   22 |   return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
   23 | }
   24 |
   25 | // Helper function to save conversation to file
   26 | function saveConversation(testName, conversation) {
   27 |   const fileName = `${testName}_${getFormattedDate()}.txt`;
   28 |   const filePath = path.join(logsDir, fileName);
   29 |   
   30 |   let content = `Language Tour Conversation: ${testName}\n`;
   31 |   content += `Recorded: ${new Date().toISOString()}\n\n`;
   32 |   
   33 |   conversation.forEach((message, index) => {
   34 |     content += `[${message.role.toUpperCase()}]: ${message.text}\n\n`;
   35 |   });
   36 |   
   37 |   fs.writeFileSync(filePath, content);
   38 |   console.log(`Conversation saved to: ${filePath}`);
   39 |   
   40 |   // Also save as JSON for potential future use
   41 |   const jsonFilePath = path.join(logsDir, `${testName}_${getFormattedDate()}.json`);
   42 |   fs.writeFileSync(jsonFilePath, JSON.stringify(conversation, null, 2));
   43 | }
   44 |
   45 | test.describe('Language Tour Conversation Recorder', () => {
   46 |   test('German business vocabulary tour', async ({ page }) => {
   47 |     const testName = 'german_business_tour';
   48 |     const conversation = [];
   49 |     
   50 |     // Set up listener for messages
   51 |     await page.exposeFunction('recordMessage', (role, text) => {
   52 |       conversation.push({ role, text, timestamp: new Date().toISOString() });
   53 |     });
   54 |     
   55 |     // Navigate to the tour creation page
   56 |     await page.goto('http://localhost:5173/dashboard/create');
   57 |     
   58 |     // Set up observers for user and AI messages
   59 |     await page.evaluate(() => {
   60 |       const observer = new MutationObserver(mutations => {
   61 |         for (const mutation of mutations) {
   62 |           if (mutation.addedNodes.length) {
   63 |             for (const node of mutation.addedNodes) {
   64 |               if (node.classList?.contains('user-message')) {
   65 |                 const text = node.textContent;
   66 |                 window.recordMessage('user', text);
   67 |               } else if (node.classList?.contains('ai-message')) {
   68 |                 const text = node.textContent;
   69 |                 window.recordMessage('ai', text);
   70 |               }
   71 |             }
   72 |           }
   73 |         }
   74 |       });
   75 |       
   76 |       // Start observing the chat container
   77 |       const chatContainer = document.querySelector('.chat-container');
   78 |       if (chatContainer) {
   79 |         observer.observe(chatContainer, { childList: true, subtree: true });
   80 |       }
   81 |     });
   82 |     
   83 |     // Wait for the AI form to be visible
   84 |     await page.waitForSelector('body > div:nth-child(1) > div.min-h-screen.flex.flex-col > main > div > div > h1', { timeout: 5000 });
   85 |     
   86 |     // Select location on map
   87 |     const mapPicker = await page.locator('.map-container');
   88 |     await expect(mapPicker).toBeVisible();
   89 |     await mapPicker.click();
   90 |     
   91 |     // Enter a language tour description
   92 |     const chatInput = await page.locator('textarea[placeholder="Type the tour description here..."]');
>  93 |     await chatInput.fill('I want to create a German language tour in Berlin focused on business vocabulary. The tour will be taught in English and is suitable for intermediate (B1) learners. It will include visits to the business district and practice ordering in restaurants.');
      |                     ^ Error: locator.fill: Test timeout of 30000ms exceeded.
   94 |     await chatInput.press('Enter');
   95 |     
   96 |     // Wait for AI response
   97 |     await page.waitForSelector('.ai-message:has-text("German")');
   98 |     await page.waitForTimeout(1000);
   99 |     
  100 |     // Continue the conversation with more details
  101 |     await chatInput.fill('Yes, the tour will be called "Business German in Berlin" and will focus on formal business greetings, restaurant vocabulary, and numbers.');
  102 |     await chatInput.press('Enter');
  103 |     
  104 |     // Wait for AI to process
  105 |     await page.waitForTimeout(2000);
  106 |     
  107 |     // Ask about specific vocabulary
  108 |     await chatInput.fill('The tour will teach vocabulary like "Guten Tag", "Auf Wiedersehen", "die Rechnung, bitte", and business meeting terminology.');
  109 |     await chatInput.press('Enter');
  110 |     
  111 |     // Wait for AI to process
  112 |     await page.waitForTimeout(2000);
  113 |     
  114 |     // Save the conversation
  115 |     saveConversation(testName, conversation);
  116 |     
  117 |     // Take a screenshot of the final state
  118 |     await page.screenshot({ path: path.join(logsDir, `${testName}_final.png`) });
  119 |   });
  120 |   
  121 |   
  122 |   
  123 |  
  124 | });
  125 |
```