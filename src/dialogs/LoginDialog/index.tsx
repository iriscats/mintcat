import React, {useState, useEffect} from 'react';
import {t} from "i18next";
import {Button, Flex, Form, Input, Modal, Tabs, message} from 'antd';
import {UserOutlined, LockOutlined, MailOutlined} from '@ant-design/icons';
import {listen} from "@tauri-apps/api/event";
const {TabPane} = Tabs;


interface LoginForm {
    email: string;
    password: string;
}

interface RegisterForm {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
}

interface ForgotPasswordForm {
    email: string;
    verificationCode: string;
    newPassword: string;
    confirmPassword: string;
}

export const LoginDialog = () => {
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<'login' | 'register' | 'forgot'>('login');
    const [loading, setLoading] = useState<boolean>(false);
    const [loginForm] = Form.useForm<LoginForm>();
    const [registerForm] = Form.useForm<RegisterForm>();
    const [forgotForm] = Form.useForm<ForgotPasswordForm>();
    const [verificationCodeSent, setVerificationCodeSent] = useState<boolean>(false);
    const [emailVerified, setEmailVerified] = useState<boolean>(false);
    const [countdown, setCountdown] = useState<number>(0);

    const handleLogin = async (values: LoginForm) => {
        try {
            setLoading(true);
            // TODO: 实现登录逻辑
            console.log('Login credentials:', values);
            message.success(t("Login successful"));
            setIsModalOpen(false);
            loginForm.resetFields();
        } catch (error) {
            console.error('Login failed:', error);
            message.error(t("Login failed"));
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (values: RegisterForm) => {
        try {
            setLoading(true);
            // TODO: 实现注册逻辑
            console.log('Register credentials:', {
                username: values.username,
                email: values.email,
                password: values.password
            });
            message.success(t("Registration successful"));
            setIsModalOpen(false);
            registerForm.resetFields();
        } catch (error) {
            console.error('Registration failed:', error);
            message.error(t("Registration failed"));
        } finally {
            setLoading(false);
        }
    };

    const handleSendVerificationCode = async () => {
        try {
            setLoading(true);
            const email = forgotForm.getFieldValue('email');
            if (!email) {
                message.error(t("Please enter your email address first"));
                return;
            }

            // TODO: 实现发送验证码逻辑
            console.log('Send verification code to:', email);
            message.success(t("Verification code sent! Please check your email."));
            setVerificationCodeSent(true);

            // 开始倒计时
            let remaining = 60;
            setCountdown(remaining);
            const timer = setInterval(() => {
                remaining--;
                setCountdown(remaining);
                if (remaining <= 0) {
                    clearInterval(timer);
                }
            }, 1000);

            // 存储定时器以便清理
            (window as any).__verificationTimer = timer;
        } catch (error) {
            console.error('Failed to send verification code:', error);
            message.error(t("Failed to send verification code. Please try again."));
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        try {
            setLoading(true);
            const email = forgotForm.getFieldValue('email');
            const code = forgotForm.getFieldValue('verificationCode');

            if (!email || !code) {
                message.error(t("Please enter both email and verification code"));
                return;
            }

            // TODO: 实现验证码验证逻辑
            console.log('Verify code:', code, 'for email:', email);
            message.success(t("Email verified successfully!"));
            setEmailVerified(true);
        } catch (error) {
            console.error('Failed to verify code:', error);
            message.error(t("Invalid verification code. Please try again."));
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (values: ForgotPasswordForm) => {
        try {
            setLoading(true);

            // TODO: 实现密码重置逻辑
            console.log('Reset password for email:', values.email);
            message.success(t("Password reset successfully!"));
            setIsModalOpen(false);
            resetForgotPasswordForm();
        } catch (error) {
            console.error('Failed to reset password:', error);
            message.error(t("Failed to reset password. Please try again."));
        } finally {
            setLoading(false);
        }
    };

    const resetForgotPasswordForm = () => {
        forgotForm.resetFields();
        setVerificationCodeSent(false);
        setEmailVerified(false);
        setCountdown(0);

        // 清理倒计时定时器
        const timer = (window as any).__verificationTimer;
        if (timer) {
            clearInterval(timer);
            delete (window as any).__verificationTimer;
        }
    };

    const handleCancel = () => {
        setIsModalOpen(false);
        loginForm.resetFields();
        registerForm.resetFields();
        resetForgotPasswordForm();
    };

    const onTabChange = (key: string) => {
        setActiveTab(key as 'login' | 'register' | 'forgot');
        if (key !== 'forgot') {
            resetForgotPasswordForm();
        }
    };

    useEffect(() => {
        listen("login-dialog-open", async () => {
            setIsModalOpen(true);
            setActiveTab('login');
        }).then();

        // 组件卸载时清理定时器
        return () => {
            const timer = (window as any).__verificationTimer;
            if (timer) {
                clearInterval(timer);
                delete (window as any).__verificationTimer;
            }
        };
    }, []);

    const renderLoginForm = () => (
        <Form
            form={loginForm}
            name="login"
            onFinish={handleLogin}
            layout="vertical"
            size="middle"
        >
            <Form.Item
                name="email"
                label={t("Email")}
                rules={[
                    {required: true, message: t("Please input your email!")},
                    {type: 'email', message: t("Please enter a valid email!")}
                ]}
            >
                <Input
                    prefix={<MailOutlined />}
                    placeholder={t("Enter your email")}
                    autoComplete="email"
                />
            </Form.Item>

            <Form.Item
                name="password"
                label={t("Password")}
                rules={[
                    {required: true, message: t("Please input your password!")},
                    {min: 6, message: t("Password must be at least 6 characters!")}
                ]}
            >
                <Input.Password
                    prefix={<LockOutlined />}
                    placeholder={t("Enter your password")}
                    autoComplete="current-password"
                />
            </Form.Item>

            <Form.Item>
                <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    block
                    style={{height: '36px'}}
                >
                    {t("Login")}
                </Button>
            </Form.Item>

            <Form.Item style={{textAlign: 'center', marginBottom: 0}}>
                <Button
                    type="link"
                    size="small"
                    onClick={() => setActiveTab('forgot')}
                    style={{padding: 0, height: 'auto', fontSize: '12px'}}
                >
                    {t("Forgot password?")}
                </Button>
            </Form.Item>
        </Form>
    );

    const renderForgotPasswordForm = () => (
        <Form
            form={forgotForm}
            name="forgot"
            onFinish={handleResetPassword}
            layout="vertical"
            size="middle"
        >
            {/* 步骤1: 输入邮箱 */}
            <Form.Item
                name="email"
                label={t("Email")}
                rules={[
                    {required: true, message: t("Please input your email!")},
                    {type: 'email', message: t("Please enter a valid email!")}
                ]}
            >
                <Input
                    prefix={<MailOutlined />}
                    placeholder={t("Enter your email address")}
                    autoComplete="email"
                    disabled={verificationCodeSent}
                />
            </Form.Item>

            {/* 步骤2: 发送验证码按钮 */}
            {!verificationCodeSent && (
                <Form.Item>
                    <Button
                        type="primary"
                        onClick={handleSendVerificationCode}
                        loading={loading}
                        block
                        style={{height: '32px'}}
                    >
                        {t("Send Verification Code")}
                    </Button>
                </Form.Item>
            )}

            {/* 步骤3: 输入验证码 */}
            {verificationCodeSent && !emailVerified && (
                <>
                    <Form.Item
                        name="verificationCode"
                        label={t("Verification Code")}
                        rules={[
                            {required: true, message: t("Please input verification code!")},
                            {len: 6, message: t("Verification code must be 6 digits!")}
                        ]}
                    >
                        <Input
                            placeholder={t("Enter 6-digit code")}
                            maxLength={6}
                            style={{textAlign: 'center'}}
                        />
                    </Form.Item>

                    <Form.Item>
                        <Button
                            type="primary"
                            onClick={handleVerifyCode}
                            loading={loading}
                            block
                            style={{height: '32px'}}
                        >
                            {t("Verify Code")}
                        </Button>
                    </Form.Item>

                    <Form.Item style={{textAlign: 'center', marginBottom: 0}}>
                        <Button
                            type="link"
                            size="small"
                            onClick={handleSendVerificationCode}
                            disabled={countdown > 0}
                            style={{padding: 0, height: 'auto', fontSize: '12px'}}
                        >
                            {countdown > 0
                                ? t(`Resend in ${countdown}s`)
                                : t("Resend verification code")
                            }
                        </Button>
                    </Form.Item>
                </>
            )}

            {/* 步骤4: 输入新密码 */}
            {emailVerified && (
                <>
                    <Form.Item
                        name="newPassword"
                        label={t("New Password")}
                        rules={[
                            {required: true, message: t("Please input your new password!")},
                            {min: 6, message: t("Password must be at least 6 characters!")}
                        ]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder={t("Enter your new password")}
                            autoComplete="new-password"
                        />
                    </Form.Item>

                    <Form.Item
                        name="confirmPassword"
                        label={t("Confirm New Password")}
                        dependencies={['newPassword']}
                        rules={[
                            {required: true, message: t("Please confirm your new password!")},
                            ({getFieldValue}) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('newPassword') === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error(t("Passwords do not match!")));
                                },
                            }),
                        ]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder={t("Confirm your new password")}
                            autoComplete="new-password"
                        />
                    </Form.Item>

                    <Form.Item>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            block
                            style={{height: '32px'}}
                        >
                            {t("Reset Password")}
                        </Button>
                    </Form.Item>
                </>
            )}

            {/* 返回登录按钮 */}
            <Form.Item style={{textAlign: 'center', marginBottom: 0}}>
                <Button
                    type="link"
                    size="small"
                    onClick={() => {
                        setActiveTab('login');
                        resetForgotPasswordForm();
                    }}
                    style={{padding: 0, height: 'auto', fontSize: '12px'}}
                >
                    {t("Back to login")}
                </Button>
            </Form.Item>
        </Form>
    );

    const renderRegisterForm = () => (
        <Form
            form={registerForm}
            name="register"
            onFinish={handleRegister}
            layout="vertical"
            size="middle"
        >
            <Form.Item
                name="username"
                label={t("Username")}
                rules={[
                    {required: true, message: t("Please input your username!")},
                    {min: 3, message: t("Username must be at least 3 characters!")},
                    {max: 20, message: t("Username cannot exceed 20 characters!")}
                ]}
            >
                <Input
                    prefix={<UserOutlined />}
                    placeholder={t("Enter your username")}
                    autoComplete="username"
                />
            </Form.Item>

            <Form.Item
                name="email"
                label={t("Email")}
                rules={[
                    {required: true, message: t("Please input your email!")},
                    {type: 'email', message: t("Please enter a valid email!")}
                ]}
            >
                <Input
                    prefix={<MailOutlined />}
                    placeholder={t("Enter your email")}
                    autoComplete="email"
                />
            </Form.Item>

            <Form.Item
                name="password"
                label={t("Password")}
                rules={[
                    {required: true, message: t("Please input your password!")},
                    {min: 6, message: t("Password must be at least 6 characters!")}
                ]}
            >
                <Input.Password
                    prefix={<LockOutlined />}
                    placeholder={t("Enter your password")}
                    autoComplete="new-password"
                />
            </Form.Item>

            <Form.Item
                name="confirmPassword"
                label={t("Confirm Password")}
                dependencies={['password']}
                rules={[
                    {required: true, message: t("Please confirm your password!")},
                    ({getFieldValue}) => ({
                        validator(_, value) {
                            if (!value || getFieldValue('password') === value) {
                                return Promise.resolve();
                            }
                            return Promise.reject(new Error(t("Passwords do not match!")));
                        },
                    }),
                ]}
            >
                <Input.Password
                    prefix={<LockOutlined />}
                    placeholder={t("Confirm your password")}
                    autoComplete="new-password"
                />
            </Form.Item>

            <Form.Item>
                <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    block
                    style={{height: '36px'}}
                >
                    {t("Register")}
                </Button>
            </Form.Item>
        </Form>
    );

    return (
        <Modal
            title={t("")}
            open={isModalOpen}
            onCancel={handleCancel}
            footer={null}
            width={420}
        >
            <Flex vertical gap="small" style={{padding: '10px 0'}}>
                <Tabs
                    activeKey={activeTab}
                    onChange={onTabChange}
                    centered
                    size="small"
                >
                    <TabPane tab={t("Login")} key="login">
                        <Flex vertical gap="small">
                            {renderLoginForm()}
                        </Flex>
                    </TabPane>
                    <TabPane tab={t("Register")} key="register">
                        <Flex vertical gap="small">
                            {renderRegisterForm()}
                        </Flex>
                    </TabPane>
                    <TabPane tab={t("Reset Password")} key="forgot">
                        <Flex vertical gap="small">
                            {renderForgotPasswordForm()}
                        </Flex>
                    </TabPane>
                </Tabs>
            </Flex>
        </Modal>
    );
};