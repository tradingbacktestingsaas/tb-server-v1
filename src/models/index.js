import { sequelize } from '../config/db.js';
import User from './user.model.js';


// // VerificationRequest associations
// User.hasMany(VerificationRequest, {
//   foreignKey: 'user_id',
//   as: 'verificationRequests',
// });

// VerificationRequest.belongsTo(User, {
//   foreignKey: 'user_id',
//   as: 'User',
// });

const db = {
  sequelize,
  User,
};

export default db;
