const axios = require('axios');
const cheerio = require('cheerio');

// The main function that Netlify will run
exports.handler = async function(event, context) {
  try {
    // The URL of the page we want to scrape
    const url = 'https://nylottery.ny.gov/';
    
    // Fetch the HTML content from the website
    const { data } = await axios.get(url);
    
    // Load the HTML into Cheerio, which lets us parse it like jQuery
    const $ = cheerio.load(data);
    
    // This is where we will store the results
    const liveResults = {};
    console.log("Scraper function started. Parsing nylottery.ny.gov...");

    // Find the elements containing the winning numbers on the page
    // This selector is more robust and less likely to change.
    $('div[class*="WinningNumbers-module--game-container"]').each((index, element) => {
      // Find the game name within each container
      const gameNameElement = $(element).find('h3 a');
      const gameName = gameNameElement.text().trim().toUpperCase();

      if (gameName) {
        console.log(`Found game container for: ${gameName}`);
        const results = {};

        // Logic for games with Midday/Evening draws (Numbers, Win 4, Take 5)
        if (gameName === 'NUMBERS' || gameName === 'WIN 4' || gameName === 'TAKE 5') {
            $(element).find('div[class*="DrawGame-module--container"]').each((i, draw) => {
                const drawTime = $(draw).find('div[class*="DrawGame-module--label"]').text().trim();
                const numbers = $(draw).find('div[class*="DrawGame-module--numbers"]').text().trim();
                if (drawTime && numbers) {
                    console.log(`  - Found draw: ${drawTime} with numbers: ${numbers}`);
                    results[drawTime] = numbers;
                }
            });
        }
        // Logic for single-draw games (Powerball, Mega Millions, etc.)
        else {
            const numbers = $(element).find('div[class*="WinningNumbers-module--numbers-container"]').text().trim();
             if (numbers) {
                console.log(`  - Found single draw with numbers: ${numbers}`);
                results['Evening'] = numbers.replace(/\s+/g, ' '); // Clean up spacing
             }
        }
        
        if (Object.keys(results).length > 0) {
          liveResults[gameName] = results;
        }
      }
    });
    
    console.log("Scraping complete. Final results:", JSON.stringify(liveResults, null, 2));

    if (Object.keys(liveResults).length === 0) {
        console.log("Warning: No results were found on the page. The website structure may have changed.");
    }

    // Return the data as a successful JSON response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Allows your website to call this function
      },
      body: JSON.stringify(liveResults),
    };
    
  } catch (error) {
    console.error("Scraping error:", error.message);
    // Return an error response
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch lottery results.' }),
    };
  }
};
