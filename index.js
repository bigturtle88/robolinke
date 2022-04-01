/**
 * Robot for LinkedIn
 * v 1.0
 *
 * @author Vyacheslav Bodrov bigturtle@i.ua
 */

const fs = require('fs');
const puppeteer = require('puppeteer');
const config = require('./config.json');

let cards = {};
let done = {};
let doneCompanies = {};

/**
 * List of users we should visit
 * @type {Object} cards
 */
try {
  cards = require('./cards.json');
} catch (err) {
  (async () => await saveCards({}))();
}

/**
 * List of user that we have already visited
 * @type {Object}
 */
try {
  done = require('./done.json');
} catch (err) {
  (async () => saveDone({}))();
}

/**
 * List of companies that we have already visited
 * @type {Object}
*/
try {
  doneCompanies = require('./companies.json');
} catch (err) {}

/**
 * Function generates a random number
 * @return {Number} number from 1000 to 3000
 */
function timeRandom() {
  return Math.floor(Math.random() * 2000) + 1000;
}

/**
 * Function for signin in Linkedin
 * @param  {Object} page Contains an object created by puppeteer
 */
async function signin(page) {
  console.log('signin');
  await page.waitFor(500);
  await page.goto(config.url);
  await page.waitFor(timeRandom());
  await page.click('a.nav__button-secondary');
  await page.waitForSelector('input[id=username]');
  await page.waitForSelector('input[id=password]');
  await page.waitFor(timeRandom());
  await page.focus('input[id=username]');
  await page.keyboard.type(config.username);
  await page.waitFor(timeRandom());
  await page.focus('input[id=password]');
  await page.keyboard.type(config.password);
  await page.waitFor(timeRandom());
  await page.click('button[aria-label="Sign in"]');
  await page.waitFor(timeRandom());
}

/**
 * Function collects links to friends accounts
 * @param  {Object} page Contains an object created by puppeteer
 * @param  {Object} done List of user that we have already visited
 * @return {Object} List of users we should visit
 */
async function parseFriendsCards(page, done) {
  console.log('parse Friends');
  const linkedinUrl = config.url;

  await page.goto(`${linkedinUrl}mynetwork/invite-connect/connections/`);
  const rawCards = await page.evaluate(({ linkedinUrl }) => {
    let cards = {};
    for (let item of document.querySelectorAll('.mn-connection-card__link')) {
      let key = item.href.replace(`${linkedinUrl}in/`, '');
      cards[key] = item.querySelectorAll('.mn-connection-card__name')[0].innerText
}
    return cards;
  },{ linkedinUrl });
  return await filterList(rawCards, done);
}

/**
 * Function controls and collects data
 * @param  {Object} page Contains an object created by puppeteer
 * @param  {Object} cards List of users we should visit
 * @param  {Object} done List of user that we have already visited
 * @param  {Object} doneCompanies  List of companies that we have already visited
 */
async function spider(page, cards, done, doneCompanies) {
  console.log('spider');
  if (Object.keys(cards).length === 0) {
    cards = await parseFriendsCards(page, done);
  }
  for (let key in cards) {
    await console.log(cards[key])
    await page.goto(`${config.url}in/${key}`);
    done[key] = cards[key];
    delete cards[key];
    await saveCardsDone(cards, done)
    await page.waitFor(timeRandom());
    cards = Object.assign(await parseSkills(page, done), cards);
  //  cards = Object.assign(await parseExperience(page, done, doneCompanies), cards);
  }
}

/**
 * The function deletes the links of those users whom we have already visited.
 * @param  {Object} rawCards List of users. Which may contain repeat users
 * @param  {Object} done List of user that we have already visited
 * @return {Object} rawCards non repeat users
 */
async function filterList(rawCards, done) { //Filter delete duplicate value in object (cards)
  for (let key in rawCards) {
    if (done.hasOwnProperty(key)) {
      delete rawCards[key];
    }
  }
  return rawCards;
}

/**
 * Function saves users
 * @param  {Object} cards List of users we should visit
 */
async function saveCards(cards) {
  await fs.writeFile('cards.json', JSON.stringify(cards), 'utf8', () => {
    console.log('Save cards');
  });
}

/**
 * Function saves users that we have already visited
 * @param  {Object} done List of user that we have already visited
 */
async function saveDone(done) {
  await fs.writeFile('done.json', JSON.stringify(done), 'utf8', () => {
    console.log('Save done');
  });
}

/**
 * Function saves users in one place
 * @param  {Object} cards List of users we should visit
 * @param  {Object} cards List of users we should visit
 */
async function saveCardsDone(cards, done) {
  await saveCards(cards);
  await saveDone(done);
}

/**
 * Function saves companies that we have already visited
 * @param  {Object} companiesDone Companiesthat we have already visited
 */
async function saveCompaniesDone(companiesDone) {
  await fs.writeFile('companies.json', JSON.stringify(companiesDone), 'utf8', () => {
    console.log('Save companies')
  });
}

/**
 * Function parsing links to user experience
 * @param  {Object} page Contains an object created by puppeteer
 * @param  {Object} done List of user that we have already visited
 * @param  {Object} doneCompanies List of companies that we have already visited
 * @return {Object} List of companies which we should visit
 */
async function parseExperience(page, done, doneCompanies) {
  console.log('experience');
  let companies = {};
  await autoScroll(page);
  companies = await page.evaluate(() => {
    let list = {};
    for (let item of document.querySelectorAll('a[data-control-name="background_details_company"]')) {
    let key = item.href;
    list[key] = item.href;
    }
    return list;
  });

  return await parseCompanies(page, companies, done, doneCompanies);
}

/**
 * Function parsing links to companies
 * @param  {Object} cards List of users we should visit
 * @param  {Object} page Contains an object created by puppeteer
 * @param  {Object} done List of user that we have already visited
 * @param  {Object} doneCompanies List of companies that we have already visited
 * @return {Object} cards List of users we should visit
 */
async function parseCompanies(page, rawCompanies, done, doneCompanies) {
  console.log('companies');
  let cards = {};
  let companies = await filterCompanies(rawCompanies, doneCompanies);

  for (let url in companies) {
    console.log(url);
    if (!!url.match(`${config.url}company/`)) {
      cards = Object.assign(await parseCompaniesCards(page, url, done), cards);
    }
    if (!!url.match(`${config.url}search/`)) {
      url = url.replace(`${config.url}search/results/all/`, `${config.url}search/results/people/`);
      cards = Object.assign(await parseSearchCards(page, url, done), cards);
    }

  }
  await saveCompaniesDone(Object.assign(rawCompanies, doneCompanies));
  return cards;
}

/**
 * The function removes duplicate companies
 * @param  {Object} rawCompanies List of companies. Which may contain repeat companies
 * @param  {Object} doneCompanies List of companies that we have already visited
 * @return {Object} rawCompanies List of companies.
 */
async function filterCompanies(rawCompanies, doneCompanies) {
  for (let key in rawCompanies) {
    console.log(key);
    if (doneCompanies.hasOwnProperty(key)) {
      console.log('Delete   -');
      console.log(key);
      delete rawCompanies[key];
    }
  }
  return rawCompanies;
}

/**
 * Function parsing links to users
 * @param  {object} page Contains an object created by puppeteer
 * @param  {String} url Link of a company page
 * @param  {Object} done List of user that we have already visited
 * @return {Object} cards List of users we should visit
 */
async function parseCompaniesCards(page, url, done) {
  await page.goto(`${url}people/`);
  await page.waitFor(timeRandom());
  await autoScroll(page);
  console.log('scroll');
  const linkedinUrl = config.url;
  let rawCards = await page.evaluate(({ linkedinUrl }) => {
    let cards = {};

    for (let item of document.querySelectorAll('a[data-control-name="people_profile_card_name_link"]')) {
      let key = item.href.replace(`${ linkedinUrl }in/`, '');
      cards[key] = item.innerText
    }
    return cards;
  }, { linkedinUrl });

  const cards = await filterList(rawCards, done);
  return cards;
}

/**
 * Function parsing links to users in search
 * @param  {object} page Contains an object created by puppeteer
 * @param  {String} url Link of a search page
 * @param  {Object} done List of user that we have already visited
 * @return {Object} cards List of users we should visit
 */
async function parseSearchCards(page, url, done) {
  await page.goto(`${url}`);
  await page.waitFor(timeRandom());
  await autoScroll(page);
  const linkedinUrl = config.url;
  let rawCards = {};
  while (await page.evaluate(() => {
      if (!document.querySelectorAll('.search-no-results__image-container')[0] &&
        !!document.querySelector('div.search-result__info > a.search-result__result-link')) {
        return true
      }
      return false;
    })) {
    await page.waitFor(timeRandom());
    await autoScroll(page);
    console.log('Search scroll');
    rawCards = Object.assign(await page.evaluate(({linkedinUrl}) => {
      let cards = {};

      for (let item of document.querySelectorAll('div.search-result__info > a.search-result__result-link')) {
        let key = item.href.replace(`${linkedinUrl}in/`, '');
        console.log(item.querySelectorAll('.actor-name')[0].innerHTML);
        cards[key] = item.querySelectorAll('.actor-name')[0].innerHTML;
      }
      console.log(cards);
      return cards;
    },{linkedinUrl}), rawCards);
    if (await page.evaluate(() => {
        if (!!document.querySelector('button[aria-label="Next"]')) {
          if (document.querySelector('button[aria-label="Next"]').disabled) {
            return false;
          }
          return true;
        } else {
          return false;
        }
      })) {
      await page.click('button[aria-label="Next"]');
    } else {
      await page.goto(`${config.url}`);
      await page.waitFor(timeRandom());
    }

  }

  let cards = await filterList(rawCards, done);
  return cards;

}

/**
 * Function parsing skills to users
 * @param  {object} page Contains an object created by puppeteer
 * @param  {Object} done List of user that we have already visited
 * @return {Object} cards List of users we should visit
 */
async function parseSkills(page, done) {
  await autoScroll(page);
  page.click('button[aria-controls="skill-categories-expanded"]');
  let skills = {};
  skills = await page.evaluate(() => {
    let skills = {};

    for (let item of document.querySelectorAll('a[data-control-name="skills_endorsement_full_list"]')) {
      let key = item.href;
      skills[key] = item.href;
    }
    return skills;
  });
  return await parseSkillsCards(page, skills, done);
}

/**
 * Function parsing links to users
 * @param  {object} page Contains an object created by puppeteer
 * @param  {Object} done List of user that we have already visited
 * @return {Object} cards List of users we should visit
 */
async function parseSkillsCards(page, skills, done) {
  console.log('skill');

  let rawCards = {};
  await page.waitFor(timeRandom());
  for (let skill in skills) {
    console.log(`a[href="${skill}"]`);
    await page.goto(skill);


    rawCards = Object.assign(await page.evaluate(() => {
      let cards = {};

      for (let item of document.getElementsByClassName('pv-endorsement-entity__link')) {
        let key = item.href.replace(`https://www.linkedin.com/in/`, '');
        console.log(item.querySelectorAll('.pv-endorsement-entity__name--has-hover')[0].innerHTML);
        cards[key] = item.querySelectorAll('.pv-endorsement-entity__name--has-hover')[0].innerHTML;
      }
      console.log(cards);
      return cards;
    }), rawCards);
    await page.waitFor(timeRandom());
    break; //add break
  }

  let cards = await filterList(rawCards, done);

  return cards;


}

/**
 * Function scroll
 * @param  {Object} page Contains an object created by puppeteer
 */
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const { scrollHeight } = document.body;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 150);
    });
  });
}

/**
 * Main function
 * @param  {Object} done List of user that we have already visited
 * @param {Object} cards List of users we should visit
 * @param  {Object} doneCompanies List of companies that we have already visited
 */
(async () => {
  console.log('RoboLinke - start');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    slowMo: 20,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await signin(page);
  await spider(page, cards, done, doneCompanies);
  await page.close();
  await browser.close();

})(cards, done, doneCompanies);
