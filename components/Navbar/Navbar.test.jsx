import { render, screen } from '@testing-library/react';
import Navbar from '@/components/Navbar/Navbar';
import { AuthContext } from '@/context/AuthContext';

jest.mock('next/router', () => ({
  useRouter: () => ({ pathname: '/', push: jest.fn() }),
}));

describe('Navbar', () => {
  it('renders brand and primary links', () => {
    render(
      <AuthContext.Provider
        value={{
          isAuthenticated: false,
          signOut: jest.fn(),
        }}
      >
        <Navbar />
      </AuthContext.Provider>
    );

    expect(screen.getByText('SmartAppointment')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Appointments')).toBeInTheDocument();
  });
});
