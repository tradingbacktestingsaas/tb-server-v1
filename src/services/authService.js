import crypto from 'crypto';
import createError from 'http-errors';
import Admin from '../models/admin.model.js';
import User from '../models/user.model.js'
import db from '../models/index.js';
import { hashPassword, comparePassword } from '../utils/hash.js';
import { generateToken } from '../utils/jwt.js';


export async function register(userDetail) {
    const existing = await User.findOne({ where: {email: userDetail.email } });
    if (existing) throw createError(409, 'Email already registered');
    const passwordHash = await hashPassword(userDetail.password);
    const user = await User.create({ ...userDetail, password: passwordHash });
    const token = generateToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        type: 'user'
    }, '1h');
    return { user: user, token };
}


export async function login({ email, password }) {
    const user = await User.findOne({ where: { email } });
    if (!user) throw createError(401, 'Invalid credentials');
    const match = await comparePassword(password, user.password);
    if (!match) throw createError(401, 'Invalid credentials');
    const token = generateToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        type: 'user'
    }, '1h');
    return { user: { id: user.id, name: user.name, email: user.email }, token };
}


export async function createPasswordResetToken(email) {
    const user = await User.findOne({ where: { email } });
    if (!user) return;


    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);


    await db.PasswordResetToken.create({ userId: user.id, tokenHash, expiresAt });
    return { user, rawToken, expiresAt };
}


export async function resetPassword({ email, token, newPassword }) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ where: { email } });
    if (!user) throw createError(400, 'Invalid request');


    const record = await db.PasswordResetToken.findOne({
        where: { userId: user.id, tokenHash, used: false, expiresAt: { [Symbol.for('gt')]: new Date() } },
        order: [['id', 'DESC']]
    });


    if (!record) throw createError(400, 'Invalid or expired reset token');


    const newHash = await hashPassword(newPassword);
    await User.update({ passwordHash: newHash }, { where: { id: user.id } })
    record.used = true;
    await record.save();
    return true;
}

const adminRegister = async ({ first_name, last_name, email, password, role = 'admin' }) => {
    // Check if admin with this email already exists
    const existing = await Admin.findOne({ where: { email } });
    if (existing) throw createError(409, 'Admin email already registered');

    // Hash the password
    const passwordHash = await hashPassword(password);

    // Create the admin
    const admin = await Admin.create({
        first_name,
        last_name,
        email,
        password: passwordHash,
        role,
        active: 1
    });

    // Generate JWT token
    const token = generateToken({
        sub: admin.id,
        email: admin.email,
        role: admin.role,
        type: 'admin'
    }, '24h');

    return {
        code: 200,
        success: true,
        message: 'Admin registered successfully',
        data: {
            id: admin.id,
            first_name: admin.first_name,
            last_name: admin.last_name,
            email: admin.email,
            role: admin.role
        },
        token
    };
}

const adminLogin = async ({ email, password }) => {
    // Find admin by email
    const admin = await Admin.findOne({ where: { email, active: 1 } });
    if (!admin) throw createError(401, 'Invalid credentials');

    // Compare password
    const match = await comparePassword(password, admin.password);
    if (!match) throw createError(401, 'Invalid credentials');

    // Generate JWT token
    const token = generateToken({
        sub: admin.id,
        email: admin.email,
        role: admin.role,
        type: 'admin'
    }, '24h');

    return {
        code: 200,
        success: true,
        message: 'Admin logged in successfully',
        data: {
            id: admin.id,
            first_name: admin.first_name,
            last_name: admin.last_name,
            email: admin.email,
            role: admin.role
        },
        token
    };
}

export const authService = {
    register,
    login,
    createPasswordResetToken,
    resetPassword,
    adminRegister,
    adminLogin
}
