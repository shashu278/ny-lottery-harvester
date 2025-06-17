const axios = require('axios');
const cheerio = require('cheerio');

// The main function that Netlify will run
exports.handler = async function(event, context) {
  try {
    const url = 'https://nylottery.ny.gov/';
    const { data } = await axios.get(url, {
      headers: {
        // Use a common user-agent to avoid being blocked
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
      }
    });
    const $ = cheerio.load(data);
    
    const liveResults = {};
    console.log("Scraper function started. Parsing nylottery.ny.gov...");

    // Find all game containers on the page using a more general attribute selector
    $('div[class*="WinningNumbers-module--game-container"]').each((index, element) => {
      const gameNameElement = $(element).find('h3 a');
      const gameName = gameNameElement.text().trim().toUpperCase();

      if (gameName) {
        console.log(`Found game container for: ${gameName}`);
        const results = {};

        // Handle games with Midday/Evening draws like NUMBERS, WIN 4, TAKE 5
        if ($(element).find('div[class*="DrawGame-module--container"]').length > 0) {
          $(element).find('div[class*="DrawGame-module--container"]').each((i, draw) => {
            const drawTime = $(draw).find('div[class*="DrawGame-module--label"]').text().trim();
            
            // Extract numbers cleanly by mapping over child elements
            const numbers = $(draw).find('div[class*="DrawGame-module--numbers"]').children().map((i, el) => $(el).text()).get().join(' ');

            if (drawTime && numbers) {
              console.log(`  - Found draw: ${drawTime} with numbers: ${numbers}`);
              results[drawTime] = numbers;
            }
          });
        } 
        // Handle single-draw games like Powerball, Mega Millions
        else {
          const numbersContainer = $(element).find('div[class*="WinningNumbers-module--numbers-container"]');
          const numbers = numbersContainer.children().map((i, el) => $(el).text()).get().join(' ');

          if (numbers) {
            console.log(`  - Found single draw with numbers: ${numbers}`);
            // Use 'Evening' as a default key for consistency
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
        console.warn("CRITICAL: No results were found on the page. The website structure has likely changed significantly.");
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(liveResults),
    };
    
  } catch (error) {
    console.error("Scraping error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch lottery results.', details: error.message }),
    };
  }
};
