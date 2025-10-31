import { tradeAccService } from "../services/tradeAccService.js";

const getTradeAcc = async (req, res) => {
  try {
    const tradeAcc = await tradeAccService.getTradeAccs(req.query);
    return res.status(201).json(tradeAcc);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};
const getTradeAccById = async (req, res) => {
  try {
    const tradeAcc = await tradeAccService.getTradeAccById(
      req.params.id,
      req.body.userId
    );
    return res.status(201).json(tradeAcc);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};
const getBrokers = async (req, res) => {
  try {
    const brokers = await tradeAccService.getBrokers(req);
    return res.status(201).json(brokers);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

// const getBrokersServer = async (req, res) => {
//   try {
//     const brokers = await tradeAccService.getBrokersServer(req);
//     return res.status(201).json(brokers);
//   } catch (error) {
//     return res.status(400).json({
//       code: 400,
//       success: false,
//       message: error.message,
//       data: null,
//     });
//   }
// };
const createTradeAcc = async (req, res) => {
  try {
    const tradeAcc = await tradeAccService.createTradeAcc(req.body);
    return res.status(201).json(tradeAcc);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};
const updateTradeAcc = async (req, res) => {
  try {
    const tradeAcc = await tradeAccService.updateTradeAcc(
      req.params.id,
      req.body
    );
    return res.status(201).json(tradeAcc);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};
const deleteTradeAcc = async (req, res) => {
  try {
    const tradeAcc = await tradeAccService.deleteTradeAcc(req.params.id);
    return res.status(201).json(tradeAcc);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};
const bulkDeleteTradeAcc = async (req, res) => {
  try {
    const tradeAcc = await tradeAccService.bulkDeleteTradeAccs(req.body);
    return res.status(201).json(tradeAcc);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};
const bulkCreateTradeAcc = async (req, res) => {
  try {
    const tradeAcc = await tradeAccService.bulkCreateTradeAccs(req.body);
    return res.status(201).json(tradeAcc);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};
const switchTradeAcc = async (req, res) => {
  try {
    const tradeAcc = await tradeAccService.switchTradeAcc(req.body);
    return res.status(201).json(tradeAcc);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};
const activeTradeAcc = async (req, res) => {
  try {
    const tradeAcc = await tradeAccService.activeTradeAcc(req.body);
    return res.status(201).json(tradeAcc);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

export const tradeAccController = {
  getTradeAcc,
  getTradeAccById,
  createTradeAcc,
  updateTradeAcc,
  deleteTradeAcc,
  bulkDeleteTradeAcc,
  bulkCreateTradeAcc,
  switchTradeAcc,
  activeTradeAcc,
  // getBrokersServer,
  getBrokers,
};
