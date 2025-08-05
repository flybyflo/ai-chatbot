'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
// import { getUser } from '@/lib/db/queries'; // No longer needed - Better Auth handles user checks
import { auth } from '@/lib/auth';

// Helper function to check if error is a Next.js redirect
function isRedirectError(error: any): boolean {
  return error?.digest?.startsWith('NEXT_REDIRECT') || error?.name === 'NEXT_REDIRECT';
}

const authFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export interface LoginActionState {
  status: 'idle' | 'in_progress' | 'success' | 'failed' | 'invalid_data';
}

export const login = async (
  _: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    console.log('Attempting login with email:', validatedData.email);
    console.log('Password length:', validatedData.password.length);
    
    try {
      const result = await auth.api.signInEmail({
        body: {
          email: validatedData.email,
          password: validatedData.password,
        },
        headers: await headers(),
      });

      console.log('Login successful:', result);
      // If we get here, the login was successful
      // Let the client handle the redirect instead of server-side redirect
      return { status: 'success' };
    } catch (authError: any) {
      // Check if it's a redirect (which means success)
      if (isRedirectError(authError)) {
        throw authError; // Re-throw redirect errors
      }
      
      // Better Auth throws errors for failed authentication
      console.error('Login error details:', {
        message: authError.message,
        status: authError.status,
        statusCode: authError.statusCode,
        body: authError.body,
        stack: authError.stack
      });
      return { status: 'failed' };
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: 'invalid_data' };
    }

    return { status: 'failed' };
  }
};

export interface RegisterActionState {
  status:
    | 'idle'
    | 'in_progress'
    | 'success'
    | 'failed'
    | 'user_exists'
    | 'invalid_data';
}

export const register = async (
  _: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    // Let Better Auth handle user existence checks

    console.log('Attempting registration with email:', validatedData.email);
    console.log('Password length:', validatedData.password.length);
    
    try {
      // Use Better Auth's sign up instead of creating user manually
      const result = await auth.api.signUpEmail({
        body: {
          email: validatedData.email,
          password: validatedData.password,
          name: validatedData.email.split('@')[0], // Use email prefix as name
        },
        headers: await headers(),
      });

      console.log('Registration successful:', result);
      // If we get here, the registration was successful
      // Let the client handle the redirect instead of server-side redirect
      return { status: 'success' };
    } catch (authError: any) {
      // Check if it's a redirect (which means success)
      if (isRedirectError(authError)) {
        throw authError; // Re-throw redirect errors
      }
      
      // Better Auth throws errors for failed authentication
      console.error('Registration error details:', {
        message: authError.message,
        status: authError.status,
        statusCode: authError.statusCode,
        body: authError.body,
        stack: authError.stack
      });
      
      // Check if it's a user already exists error
      if (authError?.message?.includes('user') && authError?.message?.includes('exists')) {
        return { status: 'user_exists' };
      }
      
      return { status: 'failed' };
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: 'invalid_data' };
    }

    return { status: 'failed' };
  }
};
