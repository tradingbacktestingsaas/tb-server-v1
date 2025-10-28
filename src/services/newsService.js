import Parser from "rss-parser";
import config from "../config/env.js";
import Sentiment from "sentiment";

const parser = new Parser();
const sentiment = new Sentiment();

async function getNews() {
  const FEED_URL = config.actionForex.apiUrl;

  const feed = await parser.parseURL(FEED_URL);

  const news = feed.items.slice(0, 20).map((item) => {
    const analysis = sentiment.analyze(item.title || "");
    const label =
      analysis.score > 1 ? "Buy" : analysis.score < -1 ? "Sell" : "Neutral";
      return {
      title: item.title,
      summary: item.summary,
      sentiment: label,
      sentimentScore: analysis.score,
      link: item.link,
      pubDate: item.pubDate,
      source: "ActionForex",
    };
  });

  return {
    success: true,
    message: "News fetched successfully",
    news: news,
  };
}

export const newsService = { getNews };
