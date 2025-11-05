/**
 * MintCat Mock API
 *
 * This file contains mock API implementations for authentication-related operations.
 * These are simulated API calls with artificial delays and realistic responses.
 */

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    username: string;
    email: string;
    password: string;
}

export interface ForgotPasswordRequest {
    email: string;
}

export interface VerifyCodeRequest {
    email: string;
    code: string;
}

export interface ResetPasswordRequest {
    email: string;
    code: string;
    newPassword: string;
}

export interface AuthResponse {
    success: boolean;
    message: string;
    data?: {
        token?: string;
        user?: {
            id: string;
            username: string;
            email: string;
        };
    };
}

// Mock data storage
const MOCK_USERS: Array<{
    id: string;
    username: string;
    email: string;
    password: string;
    verified: boolean;
}> = [];

const VERIFICATION_CODES: Map<string, string> = new Map();
const PENDING_PASSWORDS: Map<string, string> = new Map();

// Generate mock verification codes
const generateVerificationCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mock login API
 */
export const login = async (request: LoginRequest): Promise<AuthResponse> => {
    await delay(800); // Simulate network delay

    const {email, password} = request;

    // Find user
    const user = MOCK_USERS.find(u => u.email === email);

    if (!user) {
        return {
            success: false,
            message: "Invalid email or password"
        };
    }

    if (user.password !== password) {
        return {
            success: false,
            message: "Invalid email or password"
        };
    }

    if (!user.verified) {
        return {
            success: false,
            message: "Please verify your email before logging in"
        };
    }

    // Generate mock token
    const token = `mock_token_${user.id}_${Date.now()}`;

    return {
        success: true,
        message: "Login successful",
        data: {
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        }
    };
};

/**
 * Mock register API
 */
export const register = async (request: RegisterRequest): Promise<AuthResponse> => {
    await delay(1000); // Simulate network delay

    const {username, email, password} = request;

    // Check if user already exists
    const existingUser = MOCK_USERS.find(u => u.email === email || u.username === username);

    if (existingUser) {
        if (existingUser.email === email) {
            return {
                success: false,
                message: "Email already registered"
            };
        }
        if (existingUser.username === username) {
            return {
                success: false,
                message: "Username already taken"
            };
        }
    }

    // Create new user
    const newUser = {
        id: `user_${Date.now()}`,
        username,
        email,
        password,
        verified: false
    };

    MOCK_USERS.push(newUser);

    return {
        success: true,
        message: "Registration successful. Please check your email to verify your account."
    };
};

/**
 * Mock send verification code API
 */
export const sendVerificationCode = async (request: ForgotPasswordRequest): Promise<AuthResponse> => {
    await delay(500); // Simulate network delay

    const {email} = request;

    // Generate verification code
    const code = generateVerificationCode();
    VERIFICATION_CODES.set(email, code);

    console.log(`[Mock API] Verification code for ${email}: ${code}`);

    return {
        success: true,
        message: "Verification code sent successfully"
    };
};

/**
 * Mock verify code API
 */
export const verifyCode = async (request: VerifyCodeRequest): Promise<AuthResponse> => {
    await delay(400); // Simulate network delay

    const {email, code} = request;

    const storedCode = VERIFICATION_CODES.get(email);

    if (!storedCode) {
        return {
            success: false,
            message: "Verification code expired or not found. Please request a new one."
        };
    }

    if (storedCode !== code) {
        return {
            success: false,
            message: "Invalid verification code"
        };
    }

    return {
        success: true,
        message: "Email verified successfully"
    };
};

/**
 * Mock reset password API
 */
export const resetPassword = async (request: ResetPasswordRequest): Promise<AuthResponse> => {
    await delay(700); // Simulate network delay

    const {email, code, newPassword} = request;

    const storedCode = VERIFICATION_CODES.get(email);

    if (!storedCode || storedCode !== code) {
        return {
            success: false,
            message: "Invalid or expired verification code"
        };
    }

    // Find user and update password
    const user = MOCK_USERS.find(u => u.email === email);

    if (!user) {
        return {
            success: false,
            message: "User not found"
        };
    }

    user.password = newPassword;

    // Clean up verification code
    VERIFICATION_CODES.delete(email);

    return {
        success: true,
        message: "Password reset successfully"
    };
};

/**
 * Mock verify email after registration
 */
export const verifyEmail = async (email: string): Promise<AuthResponse> => {
    await delay(500);

    const user = MOCK_USERS.find(u => u.email === email);

    if (!user) {
        return {
            success: false,
            message: "User not found"
        };
    }

    user.verified = true;

    return {
        success: true,
        message: "Email verified successfully"
    };
};
