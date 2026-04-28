import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('./WalletContext', () => ({
  useWallet: () => ({ walletAddress: null, connecting: false, connectWallet: jest.fn(), disconnectWallet: jest.fn() }),
  WalletProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('./components/PixelBlast', () => () => null);
jest.mock('./components/StaggeredMenu', () => () => null);
jest.mock('./components/GlareHover', () => ({ children, style }: any) => <div style={style}>{children}</div>);
jest.mock('./components/GlitchText', () => ({ children }: any) => <span>{children}</span>);

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Deploy page (App.tsx)
// ---------------------------------------------------------------------------

import App from './App';

describe('Deploy page', () => {
  beforeEach(() => mockFetch.mockClear());

  it('renders the app requirements heading', () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.getByText('App Requirements')).toBeInTheDocument();
  });

  it('renders age, nationality and gender requirement cards', () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Nationality')).toBeInTheDocument();
    expect(screen.getByText('Gender')).toBeInTheDocument();
  });

  it('deploy button is disabled when no requirement is selected', () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.getByText('Deploy Contract').closest('button')).toBeDisabled();
  });

  it('shows age input after clicking age card', () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    fireEvent.click(screen.getByText('Age').closest('div')!);
    expect(screen.getByDisplayValue('18')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Attestation page
// ---------------------------------------------------------------------------

import Attestation from './Attestation';

describe('Attestation page', () => {
  beforeEach(() => mockFetch.mockClear());

  it('renders the fetch button', () => {
    render(<MemoryRouter><Attestation /></MemoryRouter>);
    expect(screen.getByText('Fetch TEE Attestation')).toBeInTheDocument();
  });

  it('shows error message when not in TEE', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ error: 'TEE attestation not available outside Phala enclave' }),
    });
    render(<MemoryRouter><Attestation /></MemoryRouter>);
    fireEvent.click(screen.getByText('Fetch TEE Attestation'));
    await waitFor(() => {
      expect(screen.getByText('Not running in a TEE (development mode)')).toBeInTheDocument();
    });
  });

  it('shows quote when in TEE', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ status: 'ok', quote: 'deadbeef1234', event_log: '' }),
    });
    render(<MemoryRouter><Attestation /></MemoryRouter>);
    fireEvent.click(screen.getByText('Fetch TEE Attestation'));
    await waitFor(() => {
      expect(screen.getByText('Quote')).toBeInTheDocument();
      expect(screen.getByText('deadbeef1234')).toBeInTheDocument();
    });
  });

  it('shows fetch error on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));
    render(<MemoryRouter><Attestation /></MemoryRouter>);
    fireEvent.click(screen.getByText('Fetch TEE Attestation'));
    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch/)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Verify page
// ---------------------------------------------------------------------------

import Verify from './Verify';

describe('Verify page', () => {
  it('renders wallet and contract address inputs', () => {
    render(<MemoryRouter><Verify /></MemoryRouter>);
    const inputs = screen.getAllByPlaceholderText('0x...');
    expect(inputs).toHaveLength(2);
  });

  it('view proof details button is disabled when inputs are empty', () => {
    render(<MemoryRouter><Verify /></MemoryRouter>);
    expect(screen.getByText('View Proof Details').closest('button')).toBeDisabled();
  });
});
