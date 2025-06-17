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

    // Find the elements containing the winning numbers on the page
    // NOTE: These selectors are based on the website's structure as of today
    // and may need to be updated if the website changes its design.
    $('div.WinningNumbers-module--game-container--Q48A0').each((index, element) => {
      const gameName = $(element).find('h3 a').text().trim();
      
      if (gameName === 'NUMBERS' || gameName === 'Win 4') {
        const results = {};
        $(element).find('div.DrawGame-module--container--T8aW5').each((i, draw) => {
          const drawTime = $(draw).find('div.DrawGame-module--label--c714C').text().trim(); // 'Midday' or 'Evening'
          const numbers = $(draw).find('div.DrawGame-module--numbers--JhsBW').text().trim();
          if (drawTime && numbers) {
            results[drawTime] = numbers;
          }
        });
        if(Object.keys(results).length > 0) liveResults[gameName] = results;
      }
    });

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
    console.error("Scraping error:", error);
    // Return an error response
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch lottery results.' }),
    };
  }
};
