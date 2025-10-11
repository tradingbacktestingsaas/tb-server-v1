import User from '../models/user.model.js';
import { Op, Sequelize } from "sequelize";

export async function getUsers(options = {}) {
    try {
       

    } catch (error) {
        console.error('Error in getUsers service:', error);
        throw new Error(`Failed to fetch users: ${error}`);
    }
}



export const usersService = {
    getUsers,
}
