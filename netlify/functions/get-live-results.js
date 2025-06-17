// This uses a headless browser (Puppeteer) to render the page like a real user would.
// This is the most reliable way to scrape a modern JavaScript-driven website.
const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');

exports.handler = async function(event, context) {
  let browser = null;
  
  try {
    // Launch the headless browser
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    // Go to the NY Lottery homepage
    await page.goto('https://nylottery.ny.gov/', { waitUntil: 'networkidle2' });

    // Wait for the main container of the winning numbers to be visible on the page.
    // This ensures that the JavaScript has finished loading the data.
    await page.waitForSelector('div[class*="WinningNumbers-module--container"]', { timeout: 15000 });
    
    // Now that the page is fully loaded, get the final HTML content
    const content = await page.content();

    // Use a regular expression to find the JSON data embedded in the page's script tags.
    // This is more reliable than parsing HTML with Cheerio.
    const regex = /<script id="gatsby-initial-page-data" type="application\/json">(.*?)<\/script>/;
    const match = content.match(regex);
    
    if (!match || !match[1]) {
      throw new Error("Could not find page data JSON blob.");
    }

    const pageData = JSON.parse(match[1]);
    
    // The winning numbers are deeply nested in the page's data structure.
    // We navigate this structure to find the winning numbers component.
    const winningNumbersData = pageData.result.data.allContentstackWinningNumbers.nodes;
    
    const liveResults = {};

    winningNumbersData.forEach(game => {
      const gameName = game.game_name.toUpperCase();
      
      // We only care about games that have recent draws
      if (game.draws && game.draws.length > 0) {
        liveResults[gameName] = {};
        game.draws.forEach(draw => {
          const drawTime = draw.draw_time; // 'Midday' or 'Evening'
          const numbers = draw.winning_numbers;
          if (drawTime && numbers) {
            liveResults[gameName][drawTime] = numbers;
          }
        });
      }
    });

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
