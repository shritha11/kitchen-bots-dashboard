import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';
import { Login } from '../Login';
import { User, Role } from '../../../types';

const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockSwitchOrg = vi.fn();
const mockSwitchRole = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ search: '', state: null, pathname: '/login' }),
  };
});

function renderWithProviders(ui: React.ReactElement, authOverrides = {}) {
  const defaultAuthValue = {
    user: null,
    role: null as Role | null,
    isAuthenticated: false,
    isLoading: false,
    state: { status: 'LOGGED_OUT' as const, user: null, error: null },
    login: mockLogin,
    logout: mockLogout,
    switchOrganization: mockSwitchOrg,
    switchRole: mockSwitchRole,
    ...authOverrides,
  };

  return render(
    <AuthContext.Provider value={defaultAuthValue}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('Login Page (shadcn login-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the login-02 layout with branding, form, and hero showcase', () => {
    renderWithProviders(<Login />);

    expect(screen.getByText('KitchenBots')).toBeInTheDocument();
    expect(screen.getByText(/Admin Control Center/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Login to your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Username or Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Login$/i })).toBeInTheDocument();

    // Verify slideshow dots are rendered
    expect(screen.getByLabelText('Go to slide 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Go to slide 6')).toBeInTheDocument();

    // Verify old quote card text has been removed
    expect(screen.queryByText(/Enterprise Kitchen Automation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Intelligent robotics and automated culinary systems/i)).not.toBeInTheDocument();
  });

  it('allows user to enter credentials', async () => {
    renderWithProviders(<Login />);

    const usernameInput = screen.getByLabelText(/Username or Email/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/^Password$/i) as HTMLInputElement;

    await userEvent.type(usernameInput, 'Admin');
    await userEvent.type(passwordInput, '123456');

    expect(usernameInput.value).toBe('Admin');
    expect(passwordInput.value).toBe('123456');
  });

  it('submits login and navigates to /admin on successful authentication', async () => {
    mockLogin.mockResolvedValueOnce({
      id: 'mock-admin-1',
      name: 'Admin User',
      role: 'admin',
    } as User);

    renderWithProviders(<Login />);

    const usernameInput = screen.getByLabelText(/Username or Email/i);
    const passwordInput = screen.getByLabelText(/^Password$/i);

    await userEvent.type(usernameInput, 'Admin');
    await userEvent.type(passwordInput, '123456');

    const submitButton = screen.getByRole('button', { name: /^Login$/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('Admin', '123456');
      expect(mockNavigate).toHaveBeenCalledWith('/admin', { replace: true });
    });
  });

  it('displays an error message when login fails', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid username or password'));

    renderWithProviders(<Login />);

    const usernameInput = screen.getByLabelText(/Username or Email/i);
    const passwordInput = screen.getByLabelText(/^Password$/i);

    await userEvent.type(usernameInput, 'WrongUser');
    await userEvent.type(passwordInput, 'wrongpass');

    const submitButton = screen.getByRole('button', { name: /^Login$/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid username or password')).toBeInTheDocument();
    });
  });
});
