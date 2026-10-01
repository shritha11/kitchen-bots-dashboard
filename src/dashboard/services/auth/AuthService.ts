import { User, Role } from '../../types';
import { SessionStorageAdapter, LocalStorageAdapter } from './StorageAdapter';
import { eventBus } from '../events/EventBus';
import { auth } from '../../config/firebase';
import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';

export type SessionState = 
  | 'INITIALIZING'
  | 'AUTHENTICATING'
  | 'LOGGED_IN'
  | 'LOGGED_OUT'
  | 'LOGGING_OUT'
  | 'ERROR';

export interface AuthState {
  status: SessionState;
  user: User | null;
  error: string | null;
}

export interface IAuthService {
  initialize(): Promise<AuthState>;
  login(usernameOrEmail: string, password: string): Promise<User>;
  logout(): Promise<void>;
  switchOrganization(orgId: string): Promise<void>;
  switchRole(role: Role): Promise<void>;
  getState(): AuthState;
  subscribe(listener: (state: AuthState) => void): () => void;
}

export class FirebaseAuthService implements IAuthService {
  private state: AuthState = {
    status: 'INITIALIZING',
    user: null,
    error: null,
  };
  private listeners: Set<(state: AuthState) => void> = new Set();
  private unsubAuthObserver: (() => void) | null = null;
  
  constructor(private storage: SessionStorageAdapter = new LocalStorageAdapter()) {}

  private updateState(newState: Partial<AuthState>) {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }

  getState(): AuthState {
    return this.state;
  }

  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  async initialize(): Promise<AuthState> {
    this.updateState({ status: 'INITIALIZING' });

    return new Promise((resolve) => {
      try {
        if (this.unsubAuthObserver) {
          this.unsubAuthObserver();
        }

        this.unsubAuthObserver = onAuthStateChanged(
          auth,
          async (firebaseUser: FirebaseUser | null) => {
            if (firebaseUser) {
              try {
                const token = await firebaseUser.getIdToken();
                this.storage.setToken(token);
                
                const userObj: User = {
                  id: firebaseUser.uid,
                  name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Admin User',
                  email: firebaseUser.email || '',
                  role: 'admin',
                  addresses: [],
                  wishlist: [],
                  status: 'active',
                  createdAt: new Date().toISOString()
                };
                
                this.storage.setUserData(userObj);
                this.updateState({ status: 'LOGGED_IN', user: userObj, error: null });
                eventBus.publish('SessionRestored', { userId: userObj.id });
              } catch (e: any) {
                this.updateState({ status: 'ERROR', error: e.message, user: null });
              }
            } else {
              const cachedUser = this.storage.getUserData();
              const cachedToken = this.storage.getToken();

              if (cachedUser && cachedToken) {
                this.updateState({ status: 'LOGGED_IN', user: cachedUser, error: null });
              } else {
                this.storage.clear();
                this.updateState({ status: 'LOGGED_OUT', user: null, error: null });
              }
            }
            resolve(this.state);
          },
          (error) => {
            this.updateState({ status: 'ERROR', error: error.message, user: null });
            resolve(this.state);
          }
        );
      } catch {
        const cachedUser = this.storage.getUserData();
        if (cachedUser) {
          this.updateState({ status: 'LOGGED_IN', user: cachedUser, error: null });
        } else {
          this.updateState({ status: 'LOGGED_OUT', user: null, error: null });
        }
        resolve(this.state);
      }
    });
  }

  async login(usernameOrEmail: string, password: string): Promise<User> {
    this.updateState({ status: 'AUTHENTICATING', error: null });
    
    try {
      const email = usernameOrEmail.includes('@')
        ? usernameOrEmail
        : `${usernameOrEmail.toLowerCase()}@kitchenbots.com`;
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdToken();
      
      const adminUser: User = {
        id: userCredential.user.uid,
        name: userCredential.user.displayName || userCredential.user.email?.split('@')[0] || 'Admin User',
        email: userCredential.user.email || email,
        role: 'admin',
        addresses: [],
        wishlist: [],
        status: 'active',
        createdAt: new Date().toISOString()
      };
      
      this.storage.setToken(token);
      this.storage.setUserData(adminUser);
      
      this.updateState({ status: 'LOGGED_IN', user: adminUser, error: null });
      eventBus.publish('UserLoggedIn', { userId: adminUser.id, role: adminUser.role });
      return adminUser;
    } catch (error: any) {
      let message = error.message || 'Failed to sign in with Firebase Auth';
      if (
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-email'
      ) {
        message = 'Invalid email or password';
      }
      this.updateState({ status: 'ERROR', error: message });
      const err = new Error(message);
      (err as any).cause = error;
      throw err;
    }
  }

  async logout(): Promise<void> {
    this.updateState({ status: 'LOGGING_OUT' });
    try {
      await firebaseSignOut(auth);
    } catch {
      // Ignore firebase signout error
    }
    this.storage.clear();
    this.updateState({ status: 'LOGGED_OUT', user: null, error: null });
    eventBus.publish('UserLoggedOut', undefined as void);
  }

  async switchOrganization(orgId: string): Promise<void> {
    if (this.state.status !== 'LOGGED_IN' || !this.state.user) {
      throw new Error('Must be logged in to switch organization');
    }
    
    const updatedUser = { ...this.state.user, organizationId: orgId };
    this.storage.setUserData(updatedUser);
    this.updateState({ user: updatedUser });
  }

  async switchRole(role: Role): Promise<void> {
    if (this.state.status !== 'LOGGED_IN' || !this.state.user) {
      throw new Error('Must be logged in to switch role');
    }
    
    const updatedUser = { ...this.state.user, role };
    this.storage.setUserData(updatedUser);
    this.updateState({ user: updatedUser });
  }
}

export const authService = new FirebaseAuthService();
export const MockAuthService = FirebaseAuthService;
