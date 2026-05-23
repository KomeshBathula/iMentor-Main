// frontend/src/components/auth/AuthModal.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import OtpInputComponent from './OtpInput.jsx';
import toast from 'react-hot-toast';
import { LogIn, UserPlus, X, KeyRound, AtSign, AlertCircle, HardDrive, User, School, Hash, Award, Wrench, Calendar, Lightbulb, Goal, ChevronDown, Moon, Sun, RotateCcw, ArrowLeft, ShieldCheck, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import Button from '../core/Button.jsx';
import IconButton from '../core/IconButton.jsx';
import Animate from '../core/Animate.jsx';
import api from '../../services/api.js';

const yearOptions = {
    "Bachelor's": ["1st Year", "2nd Year", "3rd Year", "4th Year"],
    "Master's": ["1st Year", "2nd Year"],
    "PhD": ["Coursework", "Research Phase", "Writing Phase"],
    "Diploma": ["1st Year", "2nd Year", "3rd Year"]
};

const getYearOptions = (degree) => {
    return yearOptions[degree] || ["1st Year", "2nd Year", "3rd Year", "4th Year", "Graduated"];
};

function AuthModal({ isOpen, onClose, initialViewIsLogin }) {
    const { login, signup } = useAuth();
    const { switchLLM: setGlobalLLM, selectedLLM } = useAppState();

    const [isLoginView, setIsLoginView] = useState(initialViewIsLogin);
    const [step, setStep] = useState(1);
    const [isOtpSent, setIsOtpSent] = useState(false);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [otp, setOtp] = useState('');

    // Forgot password state
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [forgotStep, setForgotStep] = useState(1); // 1=email, 2=otp, 3=new password
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotOtp, setForgotOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);

    const [formData, setFormData] = useState({
        email: '', password: '', localSelectedLLM: 'local_llm',
        apiKey: '',
        name: '', college: '', universityNumber: '',
        degreeType: "Bachelor's", branch: 'Computer Science', year: '1st Year',
        learningStyle: 'Reading/Writing', currentGoals: ''
    });

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [apiKeyStatus, setApiKeyStatus] = useState('idle'); // idle | checking | valid | invalid
    const [apiKeyError, setApiKeyError] = useState('');

    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;

    useEffect(() => {
        if (isOpen) {
            setError(''); setStep(1); setIsOtpSent(false); setIsSendingOtp(false);
            setOtp(''); setIsLoginView(initialViewIsLogin);
            setIsForgotPassword(false); setForgotStep(1); setForgotEmail('');
            setForgotOtp(''); setNewPassword(''); setConfirmPassword(''); setForgotLoading(false);
            setFormData({
                email: '', password: '', localSelectedLLM: selectedLLM || 'local_llm',
                apiKey: '',
                name: '', college: '', universityNumber: '',
                degreeType: "Bachelor's", branch: 'Computer Science', year: '1st Year',
                learningStyle: 'Reading/Writing', currentGoals: ''
            });
            setApiKeyStatus('idle');
            setApiKeyError('');
        }
    }, [isOpen, selectedLLM, initialViewIsLogin]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'localSelectedLLM') {
            setApiKeyStatus('idle');
            setApiKeyError('');
            setFormData(prev => ({ ...prev, apiKey: '', localSelectedLLM: value }));
            return;
        }
        setFormData(prev => {
            const newState = { ...prev, [name]: type === 'checkbox' ? checked : value };
            if (name === 'degreeType') {
                newState.year = getYearOptions(value)[0];
            }
            return newState;
        });
    };

    const handleSendOtp = async () => {
        setError('');
        if (!emailRegex.test(formData.email)) return setError("Please enter a valid email address.");
        if (formData.password.length < 6) return setError("Password must be at least 6 characters long.");

        setIsSendingOtp(true);
        const toastId = toast.loading('Sending verification code...');
        try {
            const response = await api.sendOtp(formData.email, formData.password);
            toast.success(response.message, { id: toastId });
            setIsOtpSent(true);
        } catch (err) {
            setError(err.response?.data?.message || err.message);
            toast.error(err.response?.data?.message || err.message, { id: toastId });
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleNext = async () => {
        setError('');
        // When the user has received an OTP and is about to advance to the profile form,
        // verify it with the server BEFORE showing the profile step.
        if (isOtpSent && step === 1) {
            if (otp.length !== 6) return setError('Please enter the 6-digit verification code.');
            setLoading(true);
            const toastId = toast.loading('Verifying code...');
            try {
                await api.verifyOtp(formData.email, otp);
                toast.success('Code verified!', { id: toastId });
            } catch (err) {
                const msg = err.response?.data?.message || 'Incorrect verification code. Please try again.';
                setError(msg);
                toast.error(msg, { id: toastId });
                setLoading(false);
                return;
            } finally {
                setLoading(false);
            }
        }
        if (step === 2 && (!formData.name.trim() || !formData.college.trim() || !formData.universityNumber.trim())) {
            return setError('Please fill out all academic profile fields.');
        }
        setStep(prev => prev + 1);
    };

    const handleBack = () => { setError(''); setStep(prev => prev - 1); };

    const validateApiKey = async (key) => {
        const trimmed = (key ?? formData.apiKey).trim();
        const prov = formData.localSelectedLLM;
        if (!trimmed || prov === 'local_llm') return;
        setApiKeyStatus('checking');
        setApiKeyError('');
        try {
            const result = await api.validateLLMKeyPublic({ provider: prov, apiKey: trimmed });
            if (result.ok) {
                setApiKeyStatus('valid');
            } else {
                setApiKeyStatus('invalid');
                setApiKeyError(result.message || 'Invalid API key.');
            }
        } catch (err) {
            setApiKeyStatus('invalid');
            setApiKeyError(err.response?.data?.message || err.message || 'Validation failed.');
        }
    };

    // --- Forgot Password Handlers ---
    const handleForgotSendOtp = async () => {
        setError('');
        if (!emailRegex.test(forgotEmail)) return setError('Please enter a valid email address.');
        setForgotLoading(true);
        const toastId = toast.loading('Sending reset code...');
        try {
            const response = await api.forgotPassword(forgotEmail);
            toast.success(response.message || 'Reset code sent!', { id: toastId });
            setForgotStep(2);
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            setError(msg);
            toast.error(msg, { id: toastId });
        } finally {
            setForgotLoading(false);
        }
    };

    const handleForgotVerifyOtp = async () => {
        setError('');
        if (forgotOtp.length !== 6) return setError('Please enter the 6-digit code.');
        setForgotLoading(true);
        const toastId = toast.loading('Verifying code...');
        try {
            await api.verifyForgotOtp(forgotEmail, forgotOtp);
            toast.success('Code verified!', { id: toastId });
            setForgotStep(3);
        } catch (err) {
            const msg = err.response?.data?.message || 'Invalid or expired code. Please try again.';
            setError(msg);
            toast.error(msg, { id: toastId });
        } finally {
            setForgotLoading(false);
        }
    };

    const handleResetPassword = async () => {
        setError('');
        if (newPassword.length < 6) return setError('Password must be at least 6 characters long.');
        if (newPassword !== confirmPassword) return setError('Passwords do not match.');
        setForgotLoading(true);
        const toastId = toast.loading('Resetting password...');
        try {
            const response = await api.resetPassword(forgotEmail, forgotOtp, newPassword);
            toast.success(response.message || 'Password reset successful!', { id: toastId });
            // Return to login view with email pre-filled
            setIsForgotPassword(false);
            setForgotStep(1);
            setForgotOtp(''); setNewPassword(''); setConfirmPassword('');
            setFormData(prev => ({ ...prev, email: forgotEmail, password: '' }));
            setForgotEmail('');
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            setError(msg);
            toast.error(msg, { id: toastId });
        } finally {
            setForgotLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (isLoginView) {
            const toastId = toast.loading('Logging in...');
            try {
                const { email, password } = formData;
                if (!emailRegex.test(email)) throw new Error("Please enter a valid email address.");
                const authDataResponse = await login({ email, password });
                if (authDataResponse.isAdminLogin) toast.success("Admin login successful!", { id: toastId });
                else toast.success(authDataResponse.message || 'Login Successful!', { id: toastId });
                onClose(authDataResponse);
            } catch (err) {
                const errorMessage = err.response?.data?.message || err.message;
                setError(errorMessage);
                toast.error(errorMessage, { id: toastId });
            } finally { setLoading(false); }
        } else {
            const toastId = toast.loading('Creating your account...');
            // Use local_llm as default for signup (user chooses LLM after login)

            try {
                const finalSignupData = { 
                    ...formData, 
                    preferredLlmProvider: 'local_llm',  // Backend expects this field name
                    otp 
                };
                console.log('[SIGNUP DEBUG] Sending:', JSON.stringify(finalSignupData, null, 2));
                const authDataResponse = await signup(finalSignupData);
                setGlobalLLM('local_llm');
                toast.success(authDataResponse.message || 'Signup Successful!', { id: toastId });
                onClose(authDataResponse);
            } catch (err) {
                const errorMessage = err.response?.data?.message || err.message;
                setError(errorMessage);
                toast.error(errorMessage, { id: toastId });
            } finally { setLoading(false); }
        }
    };

    const inputWrapperClass = "relative";
    const inputIconClass = "absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400";
    const inputFieldStyledClass = "bg-gray-900 border border-gray-700 rounded-lg pl-10 py-2.5 text-sm w-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-all";

    const renderStep1 = () => (
        <div className="space-y-5">
            <div className={inputWrapperClass}>
                <AtSign className={inputIconClass} />
                <input type="email" name="email" className={inputFieldStyledClass} placeholder="Email Address" value={formData.email} onChange={handleChange} required disabled={loading || isOtpSent || isSendingOtp} />
            </div>
            <div className={inputWrapperClass}>
                <KeyRound className={inputIconClass} />
                <input type="password" name="password" className={inputFieldStyledClass} placeholder="Password (min. 6 characters)" value={formData.password} onChange={handleChange} required minLength="6" disabled={loading || isOtpSent || isSendingOtp} />
            </div>

                {isOtpSent && (
                    <Animate key="otp-input" animation="slide-up" className="pt-2 text-center">
                        <label className="block text-sm font-medium text-white mb-3">A verification code has been sent to your email.</label>
                        <OtpInputComponent otp={otp} setOtp={setOtp} onComplete={handleNext} />
                    </Animate>
                )}
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-4">
            <p className="text-sm text-center text-gray-400">Tell us a bit about your academic background.</p>
            <div className={inputWrapperClass}>
                <User className={inputIconClass} />
                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Full Name" className={inputFieldStyledClass} required />
            </div>
            <div className={inputWrapperClass}>
                <School className={inputIconClass} />
                <input type="text" name="college" value={formData.college} onChange={handleChange} placeholder="College / Institution" className={inputFieldStyledClass} required />
            </div>
            <div className={inputWrapperClass}>
                <Hash className={inputIconClass} />
                <input type="text" name="universityNumber" value={formData.universityNumber} onChange={handleChange} placeholder="University Number" className={inputFieldStyledClass} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className={inputWrapperClass}>
                    <Award className={inputIconClass} />
                    <select name="degreeType" value={formData.degreeType} onChange={handleChange} className="bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-8 py-2.5 text-sm appearance-none text-left text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-all" required>
                        <option className="bg-black">Bachelor's</option>
                        <option className="bg-black">Master's</option>
                        <option className="bg-black">PhD</option>
                        <option className="bg-black">Diploma</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                </div>
                <div className={inputWrapperClass}>
                    <Wrench className={inputIconClass} />
                    <select name="branch" value={formData.branch} onChange={handleChange} className="bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-8 py-2.5 text-sm appearance-none text-left text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-all" required>
                        <option className="bg-black">Computer Science</option>
                        <option className="bg-black">Mechanical</option>
                        <option className="bg-black">Electrical</option>
                        <option className="bg-black">Civil</option>
                        <option className="bg-black">Electronics</option>
                        <option className="bg-black">Other</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                </div>
                <div className={inputWrapperClass}>
                    <Calendar className={inputIconClass} />
                    <select name="year" value={formData.year} onChange={handleChange} className="bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-8 py-2.5 text-sm appearance-none text-left text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-all" required>
                        {getYearOptions(formData.degreeType).map(option => (
                            <option key={option} value={option} className="bg-black">{option}</option>
                        ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                </div>
            </div>
            <div className="space-y-2 pt-2">
                <label className="block text-sm font-medium text-white">How do you learn best?</label>
                <div className={inputWrapperClass}>
                    <Lightbulb className={inputIconClass} />
                    <select name="learningStyle" value={formData.learningStyle} onChange={handleChange} className="bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-8 py-2.5 text-sm appearance-none text-left text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-all" required>
                        <option value="Reading/Writing" className="bg-black">Reading/Writing (detailed text)</option>
                        <option value="Visual" className="bg-black">Visual (diagrams, mind maps)</option>
                        <option value="Auditory" className="bg-black">Auditory (podcasts, explanations)</option>
                        <option value="Kinesthetic" className="bg-black">Kinesthetic (hands-on examples, code)</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                </div>
            </div>
            <div className="space-y-2">
                <label className="block text-sm font-medium text-white">What are your current learning goals? (Optional)</label>
                <div className={inputWrapperClass}>
                    <Goal className={inputIconClass} />
                    <textarea name="currentGoals" value={formData.currentGoals} onChange={handleChange} placeholder="e.g., 'Prepare for my AI exam', 'Understand thermodynamics basics'" className={`${inputFieldStyledClass} !h-24 resize-none`} maxLength="500"></textarea>
                </div>
            </div>
        </div>
    );


    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fadeIn">
            <Animate
                key="auth-modal-content"
                animation="scale-in"
                className="bg-black rounded-xl shadow-2xl p-6 sm:p-8 w-full max-w-lg border border-gray-800"
            >
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white">
                            {isForgotPassword ? 'Reset Password' : isLoginView ? 'Welcome Back' : 'Create Your Account'}
                        </h2>
                        {isForgotPassword && <p className="text-sm text-gray-400">Step {forgotStep} of 3</p>}
                            {!isLoginView && !isForgotPassword && <p className="text-sm text-gray-400">Step {step} of 2</p>}
                    </div>
                    <div className="flex items-center gap-2">
                        <IconButton icon={X} onClick={() => onClose(null)} variant="monochrome" size="sm" title="Close" className="text-white hover:bg-gray-900" />
                    </div>
                </div>

                {isForgotPassword && (
                    <div className="w-full bg-gray-800 rounded-full h-1.5 mb-6">
                        <div
                            className="bg-white h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${(forgotStep / 3) * 100}%` }}
                        />
                    </div>
                )}

                {!isLoginView && !isForgotPassword && (
                    <div className="w-full bg-gray-800 rounded-full h-1.5 mb-6">
                        <div
                            className="bg-white h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${(step / 2) * 100}%` }}
                        />
                    </div>
                )}

                {error && (
                    <div className="mb-4 p-3 bg-gray-900 border border-white text-white rounded-md text-sm flex items-center gap-2">
                        <AlertCircle size={16} />{error}
                    </div>
                )}

                {isForgotPassword ? (
                    /* ====== FORGOT PASSWORD FLOW ====== */
                    <div className="space-y-5">
                            <Animate
                                key={`forgot-step-${forgotStep}`}
                                animation="slide-left"
                            >
                                {forgotStep === 1 && (
                                    <div className="space-y-5">
                                        <p className="text-sm text-gray-400 text-center">Enter your email address and we'll send you a code to reset your password.</p>
                                        <div className={inputWrapperClass}>
                                            <AtSign className={inputIconClass} />
                                            <input type="email" className={inputFieldStyledClass} placeholder="Email Address" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required disabled={forgotLoading} />
                                        </div>
                                    </div>
                                )}

                                {forgotStep === 2 && (
                                    <div className="space-y-5">
                                        <p className="text-sm text-gray-400 text-center">A reset code has been sent to <span className="text-white font-medium">{forgotEmail}</span></p>
                                        <OtpInputComponent otp={forgotOtp} setOtp={setForgotOtp} onComplete={handleForgotVerifyOtp} />
                                    </div>
                                )}

                                {forgotStep === 3 && (
                                    <div className="space-y-5">
                                        <div className="flex items-center justify-center gap-2 text-green-400 text-sm">
                                            <ShieldCheck size={16} />
                                            <span>Code verified! Enter your new password below.</span>
                                        </div>
                                        <div className={inputWrapperClass}>
                                            <KeyRound className={inputIconClass} />
                                            <input type="password" className={inputFieldStyledClass} placeholder="New Password (min. 6 characters)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength="6" disabled={forgotLoading} />
                                        </div>
                                        <div className={inputWrapperClass}>
                                            <KeyRound className={inputIconClass} />
                                            <input type="password" className={inputFieldStyledClass} placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength="6" disabled={forgotLoading} />
                                        </div>
                                    </div>
                                )}
                            </Animate>
                            <Button type="button" variant="monochrome-outline" onClick={() => {
                                if (forgotStep === 1) {
                                    setIsForgotPassword(false); setError(''); setForgotEmail('');
                                } else {
                                    setForgotStep(prev => prev - 1); setError('');
                                }
                            }} disabled={forgotLoading} leftIcon={<ArrowLeft size={16} />} className="border-white text-white hover:bg-white hover:text-black">
                                Back
                            </Button>
                            <div className="flex-grow">
                                {forgotStep === 1 && (
                                    <Button type="button" fullWidth onClick={handleForgotSendOtp} isLoading={forgotLoading} variant="monochrome-outline" className="py-2.5 !text-base bg-white text-black hover:bg-gray-200">
                                        Send Reset Code
                                    </Button>
                                )}
                                {forgotStep === 2 && (
                                    <Button type="button" fullWidth onClick={handleForgotVerifyOtp} disabled={forgotLoading || forgotOtp.length !== 6} variant="monochrome-outline" className="py-2.5 !text-base bg-white text-black hover:bg-gray-200">
                                        Verify Code
                                    </Button>
                                )}
                                {forgotStep === 3 && (
                                    <Button type="button" fullWidth onClick={handleResetPassword} isLoading={forgotLoading} leftIcon={<RotateCcw size={18} />} variant="monochrome-outline" className="py-2.5 !text-base bg-white text-black hover:bg-gray-200">
                                        Reset Password
                                    </Button>
                                )}
                            </div>
                    </div>
                ) : (
                    /* ====== NORMAL LOGIN / SIGNUP FORM ====== */
                    <form onSubmit={handleSubmit} className="space-y-5">
                            <Animate
                                key={isLoginView ? 'login' : `step${step}`}
                                animation="slide-left"
                            >
                                {isLoginView ? (
                                    <div className="space-y-5">
                                        <div className={inputWrapperClass}>
                                            <AtSign className={inputIconClass} />
                                            <input type="email" name="email" className={inputFieldStyledClass} placeholder="Email Address" value={formData.email} onChange={handleChange} required disabled={loading} />
                                        </div>
                                        <div className={inputWrapperClass}>
                                            <KeyRound className={inputIconClass} />
                                            <input type="password" name="password" className={inputFieldStyledClass} placeholder="Password" value={formData.password} onChange={handleChange} required disabled={loading} />
                                        </div>
                                        <div className="text-right">
                                            <button
                                                type="button"
                                                onClick={() => { setIsForgotPassword(true); setError(''); setForgotEmail(formData.email); }}
                                                className="text-sm text-gray-400 hover:text-white transition-colors"
                                                disabled={loading}
                                            >
                                                Forgot Password?
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {step === 1 && renderStep1()}
                                        {step === 2 && renderStep2()}
                                    </>
                                )}
                            </Animate>



                        <div className="pt-2 flex items-center gap-3">
                            {!isLoginView && step > 1 && (
                                <Button type="button" variant="monochrome-outline" onClick={handleBack} disabled={loading} className="border-white text-white hover:bg-white hover:text-black"> Back </Button>
                            )}
                            <div className="flex-grow">
                                {isLoginView ? (
                                    <Button type="submit" fullWidth isLoading={loading} leftIcon={<LogIn size={18} />} variant="monochrome-outline" className="py-2.5 !text-base bg-white text-black hover:bg-gray-200">Login</Button>
                                ) : step === 1 ? (
                                    !isOtpSent ? (
                                        <Button type="button" fullWidth onClick={handleSendOtp} isLoading={isSendingOtp} disabled={loading} variant="monochrome-outline" className="py-2.5 !text-base bg-white text-black hover:bg-gray-200">Send Code & Continue</Button>
                                    ) : (
                                        <Button type="button" fullWidth onClick={handleNext} disabled={loading || otp.length !== 6} variant="monochrome-outline" className="py-2.5 !text-base bg-white text-black hover:bg-gray-200">Continue</Button>
                                    )
                                ) : (
                                    <Button type="submit" fullWidth isLoading={loading} leftIcon={<UserPlus size={18} />} variant="monochrome-outline" className="py-2.5 !text-base bg-white text-black hover:bg-gray-200">Create Account</Button>
                                )}
                            </div>
                        </div>
                    </form>
                )}

                {!isForgotPassword && (
                    <p className="mt-6 text-center text-sm text-gray-400">
                        <button onClick={() => { setIsLoginView(!isLoginView); setError(''); setStep(1); setIsOtpSent(false); setOtp(''); }} className="font-medium text-white hover:underline" disabled={loading}>
                            {isLoginView ? "Don't have an account? Sign Up" : "Already have an account? Login"}
                        </button>
                    </p>
                )}
            </Animate>
        </div>
    );
}
export default AuthModal;