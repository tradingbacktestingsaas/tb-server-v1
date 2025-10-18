import { newsService } from "../services/newsService.js";

export const newsController = {
  getNews: async (req, res) => {
    try {
      const news = await newsService.getNews();
      return res.status(201).json({
        code: 201,
        success: true,
        message: "news fetched successfully",
        data: news,
      });
    } catch (error) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: error.message,
        data: null,
      });
    }
  },
};
