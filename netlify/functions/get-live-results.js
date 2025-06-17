const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');

// Helper function to get today's date in the MM/DD/YY format for New York
function getTodaysDateFormatted() {
  const today = new Date();
  const options = {
    timeZone: 'America/New_York',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  };
  return new Intl.DateTimeFormat('en-US', options).format(today);
}

exports.handler = async function(event, context) {
  let browser = null;
  const todaysDate = getTodaysDateFormatted();
  console.log(`Starting headless browser for date: ${todaysDate}`);

  try {
    // Launch the headless browser with optimizations
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    
    // Optimize by blocking unnecessary resources like images and CSS
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Go to the NY Lottery homepage
    await page.goto('https://nylottery.ny.gov/', { waitUntil: 'networkidle2', timeout: 20000 });

    // Use page.evaluate to run code directly in the browser's context
    // This is faster and more reliable than passing the HTML back and forth
    const liveResults = await page.evaluate((date) => {
      const results = {};
      // Select all game containers on the page
      const gameContainers = document.querySelectorAll('div[class*="WinningNumbers-module--game-container"]');
      
      gameContainers.forEach(container => {
        const gameNameElement = container.querySelector('h3 a');
        if (!gameNameElement) return;
        
        const gameName = gameNameElement.innerText.trim().toUpperCase();
        const gameDraws = {};

        // Find Midday/Evening draw containers
        const drawElements = container.querySelectorAll('div[class*="DrawGame-module--container"]');
        if (drawElements.length > 0) {
            drawElements.forEach(draw => {
                const drawTime = draw.querySelector('div[class*="DrawGame-module--label"]').innerText.trim();
                const dateText = draw.querySelector('div[class*="DrawGame-module--date-"]').innerText.trim();
                
                if (dateText.includes(date)) {
                    const numbers = Array.from(draw.querySelectorAll('div[class*="DrawGame-module--numbers"] span')).map(span => span.innerText).join(' ');
                    gameDraws[drawTime] = numbers;
                }
            });
        }
        
        if (Object.keys(gameDraws).length > 0) {
            results[gameName] = gameDraws;
        }
      });
      return results;
    }, todaysDate); // Pass today's date into the browser context

    await browser.close();

    console.log("Scraping complete. Final live results:", JSON.stringify(liveResults, null, 2));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(liveResults),
    };
  } catch (error) {
    console.error('Error in headless browser function:', error);
    if (browser !== null) {
      await browser.close();
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch lottery results.', details: error.message }),
    };
  }
};
