import { useState } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import PixelBlast from './components/PixelBlast';
import GlareHover from './components/GlareHover';
import GlitchText from './components/GlitchText';

const FACTORY_ADDRESS = '0x12c9169DD8067e2D30a9d660b2bab3848279413a';
const SP1_VERIFIER_ADDRESS = '0x397A5f7f3dBd538f23DE225B51f532c34448dA9B';
const PASSPORT_VKEY = '0x00e73dac84f6c42374ebe6d54e839ed1fb039bbfb193e8daa5542359657a818c';

const FACTORY_ABI = [
  'function createVerifier(address _sp1Verifier, bytes32 _passportVKey, bool _requireAge, uint256 _minAge, bool _requireNationality, string _targetNationality, bool _requireSex, string _targetSex) external returns (address)',
  'event VerifierCreated(address indexed verifier, address indexed owner, bool requireAge, uint256 minAge, bool requireNationality, string targetNationality, bool requireSex, string targetSex)'
];

const COUNTRIES: { code: string; name: string }[] = [
  { code: 'AFG', name: 'Afghanistan' }, { code: 'ALB', name: 'Albania' }, { code: 'DZA', name: 'Algeria' },
  { code: 'AND', name: 'Andorra' }, { code: 'AGO', name: 'Angola' }, { code: 'ATG', name: 'Antigua and Barbuda' },
  { code: 'ARG', name: 'Argentina' }, { code: 'ARM', name: 'Armenia' }, { code: 'AUS', name: 'Australia' },
  { code: 'AUT', name: 'Austria' }, { code: 'AZE', name: 'Azerbaijan' }, { code: 'BHS', name: 'Bahamas' },
  { code: 'BHR', name: 'Bahrain' }, { code: 'BGD', name: 'Bangladesh' }, { code: 'BRB', name: 'Barbados' },
  { code: 'BLR', name: 'Belarus' }, { code: 'BEL', name: 'Belgium' }, { code: 'BLZ', name: 'Belize' },
  { code: 'BEN', name: 'Benin' }, { code: 'BTN', name: 'Bhutan' }, { code: 'BOL', name: 'Bolivia' },
  { code: 'BIH', name: 'Bosnia and Herzegovina' }, { code: 'BWA', name: 'Botswana' }, { code: 'BRA', name: 'Brazil' },
  { code: 'BRN', name: 'Brunei' }, { code: 'BGR', name: 'Bulgaria' }, { code: 'BFA', name: 'Burkina Faso' },
  { code: 'BDI', name: 'Burundi' }, { code: 'CPV', name: 'Cabo Verde' }, { code: 'KHM', name: 'Cambodia' },
  { code: 'CMR', name: 'Cameroon' }, { code: 'CAN', name: 'Canada' }, { code: 'CAF', name: 'Central African Republic' },
  { code: 'TCD', name: 'Chad' }, { code: 'CHL', name: 'Chile' }, { code: 'CHN', name: 'China' },
  { code: 'COL', name: 'Colombia' }, { code: 'COM', name: 'Comoros' }, { code: 'COD', name: 'Congo (DRC)' },
  { code: 'COG', name: 'Congo (Republic)' }, { code: 'CRI', name: 'Costa Rica' }, { code: 'CIV', name: "Côte d'Ivoire" },
  { code: 'HRV', name: 'Croatia' }, { code: 'CUB', name: 'Cuba' }, { code: 'CYP', name: 'Cyprus' },
  { code: 'CZE', name: 'Czech Republic' }, { code: 'DNK', name: 'Denmark' }, { code: 'DJI', name: 'Djibouti' },
  { code: 'DOM', name: 'Dominican Republic' }, { code: 'ECU', name: 'Ecuador' }, { code: 'EGY', name: 'Egypt' },
  { code: 'SLV', name: 'El Salvador' }, { code: 'GNQ', name: 'Equatorial Guinea' }, { code: 'ERI', name: 'Eritrea' },
  { code: 'EST', name: 'Estonia' }, { code: 'SWZ', name: 'Eswatini' }, { code: 'ETH', name: 'Ethiopia' },
  { code: 'FJI', name: 'Fiji' }, { code: 'FIN', name: 'Finland' }, { code: 'FRA', name: 'France' },
  { code: 'GAB', name: 'Gabon' }, { code: 'GMB', name: 'Gambia' }, { code: 'GEO', name: 'Georgia' },
  { code: 'DEU', name: 'Germany' }, { code: 'GHA', name: 'Ghana' }, { code: 'GRC', name: 'Greece' },
  { code: 'GRD', name: 'Grenada' }, { code: 'GTM', name: 'Guatemala' }, { code: 'GIN', name: 'Guinea' },
  { code: 'GNB', name: 'Guinea-Bissau' }, { code: 'GUY', name: 'Guyana' }, { code: 'HTI', name: 'Haiti' },
  { code: 'HND', name: 'Honduras' }, { code: 'HUN', name: 'Hungary' }, { code: 'ISL', name: 'Iceland' },
  { code: 'IND', name: 'India' }, { code: 'IDN', name: 'Indonesia' }, { code: 'IRN', name: 'Iran' },
  { code: 'IRQ', name: 'Iraq' }, { code: 'IRL', name: 'Ireland' }, { code: 'ISR', name: 'Israel' },
  { code: 'ITA', name: 'Italy' }, { code: 'JAM', name: 'Jamaica' }, { code: 'JPN', name: 'Japan' },
  { code: 'JOR', name: 'Jordan' }, { code: 'KAZ', name: 'Kazakhstan' }, { code: 'KEN', name: 'Kenya' },
  { code: 'KIR', name: 'Kiribati' }, { code: 'PRK', name: 'Korea (North)' }, { code: 'KOR', name: 'Korea (South)' },
  { code: 'KWT', name: 'Kuwait' }, { code: 'KGZ', name: 'Kyrgyzstan' }, { code: 'LAO', name: 'Laos' },
  { code: 'LVA', name: 'Latvia' }, { code: 'LBN', name: 'Lebanon' }, { code: 'LSO', name: 'Lesotho' },
  { code: 'LBR', name: 'Liberia' }, { code: 'LBY', name: 'Libya' }, { code: 'LIE', name: 'Liechtenstein' },
  { code: 'LTU', name: 'Lithuania' }, { code: 'LUX', name: 'Luxembourg' }, { code: 'MDG', name: 'Madagascar' },
  { code: 'MWI', name: 'Malawi' }, { code: 'MYS', name: 'Malaysia' }, { code: 'MDV', name: 'Maldives' },
  { code: 'MLI', name: 'Mali' }, { code: 'MLT', name: 'Malta' }, { code: 'MHL', name: 'Marshall Islands' },
  { code: 'MRT', name: 'Mauritania' }, { code: 'MUS', name: 'Mauritius' }, { code: 'MEX', name: 'Mexico' },
  { code: 'FSM', name: 'Micronesia' }, { code: 'MDA', name: 'Moldova' }, { code: 'MCO', name: 'Monaco' },
  { code: 'MNG', name: 'Mongolia' }, { code: 'MNE', name: 'Montenegro' }, { code: 'MAR', name: 'Morocco' },
  { code: 'MOZ', name: 'Mozambique' }, { code: 'MMR', name: 'Myanmar' }, { code: 'NAM', name: 'Namibia' },
  { code: 'NRU', name: 'Nauru' }, { code: 'NPL', name: 'Nepal' }, { code: 'NLD', name: 'Netherlands' },
  { code: 'NZL', name: 'New Zealand' }, { code: 'NIC', name: 'Nicaragua' }, { code: 'NER', name: 'Niger' },
  { code: 'NGA', name: 'Nigeria' }, { code: 'MKD', name: 'North Macedonia' }, { code: 'NOR', name: 'Norway' },
  { code: 'OMN', name: 'Oman' }, { code: 'PAK', name: 'Pakistan' }, { code: 'PLW', name: 'Palau' },
  { code: 'PAN', name: 'Panama' }, { code: 'PNG', name: 'Papua New Guinea' }, { code: 'PRY', name: 'Paraguay' },
  { code: 'PER', name: 'Peru' }, { code: 'PHL', name: 'Philippines' }, { code: 'POL', name: 'Poland' },
  { code: 'PRT', name: 'Portugal' }, { code: 'QAT', name: 'Qatar' }, { code: 'ROU', name: 'Romania' },
  { code: 'RUS', name: 'Russia' }, { code: 'RWA', name: 'Rwanda' }, { code: 'KNA', name: 'Saint Kitts and Nevis' },
  { code: 'LCA', name: 'Saint Lucia' }, { code: 'VCT', name: 'Saint Vincent and the Grenadines' },
  { code: 'WSM', name: 'Samoa' }, { code: 'SMR', name: 'San Marino' }, { code: 'STP', name: 'Sao Tome and Principe' },
  { code: 'SAU', name: 'Saudi Arabia' }, { code: 'SEN', name: 'Senegal' }, { code: 'SRB', name: 'Serbia' },
  { code: 'SYC', name: 'Seychelles' }, { code: 'SLE', name: 'Sierra Leone' }, { code: 'SGP', name: 'Singapore' },
  { code: 'SVK', name: 'Slovakia' }, { code: 'SVN', name: 'Slovenia' }, { code: 'SLB', name: 'Solomon Islands' },
  { code: 'SOM', name: 'Somalia' }, { code: 'ZAF', name: 'South Africa' }, { code: 'SSD', name: 'South Sudan' },
  { code: 'ESP', name: 'Spain' }, { code: 'LKA', name: 'Sri Lanka' }, { code: 'SDN', name: 'Sudan' },
  { code: 'SUR', name: 'Suriname' }, { code: 'SWE', name: 'Sweden' }, { code: 'CHE', name: 'Switzerland' },
  { code: 'SYR', name: 'Syria' }, { code: 'TWN', name: 'Taiwan' }, { code: 'TJK', name: 'Tajikistan' },
  { code: 'TZA', name: 'Tanzania' }, { code: 'THA', name: 'Thailand' }, { code: 'TLS', name: 'Timor-Leste' },
  { code: 'TGO', name: 'Togo' }, { code: 'TON', name: 'Tonga' }, { code: 'TTO', name: 'Trinidad and Tobago' },
  { code: 'TUN', name: 'Tunisia' }, { code: 'TUR', name: 'Turkey' }, { code: 'TKM', name: 'Turkmenistan' },
  { code: 'TUV', name: 'Tuvalu' }, { code: 'UGA', name: 'Uganda' }, { code: 'UKR', name: 'Ukraine' },
  { code: 'ARE', name: 'United Arab Emirates' }, { code: 'GBR', name: 'United Kingdom' },
  { code: 'USA', name: 'United States' }, { code: 'URY', name: 'Uruguay' }, { code: 'UZB', name: 'Uzbekistan' },
  { code: 'VUT', name: 'Vanuatu' }, { code: 'VEN', name: 'Venezuela' }, { code: 'VNM', name: 'Vietnam' },
  { code: 'YEM', name: 'Yemen' }, { code: 'ZMB', name: 'Zambia' }, { code: 'ZWE', name: 'Zimbabwe' },
];

function App() {
  const [ageOn, setAgeOn] = useState(false);
  const [nationalityOn, setNationalityOn] = useState(false);
  const [genderOn, setGenderOn] = useState(false);
  const [minAge, setMinAge] = useState(18);
  const [targetNationality, setTargetNationality] = useState('AFG');
  const [targetSex, setTargetSex] = useState('M');

  const inputStyle: React.CSSProperties = {
    marginTop: '1rem',
    width: '100%',
    padding: '0.5rem',
    background: '#000',
    border: '1px solid #fff',
    color: '#fff',
    fontFamily: "'Major Mono Display', monospace",
    fontSize: '1rem',
    fontWeight: 'bold',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'><path d='M7 10l5 5 5-5z'/></svg>")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.5rem center',
    backgroundSize: '1.5rem',
    paddingRight: '3rem',
  };
  const [deploying, setDeploying] = useState(false);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connectWallet = async () => {
    if (!(window as any).ethereum) {
      alert('MetaMask is not installed');
      return;
    }
    setConnecting(true);
    try {
      const provider = new BrowserProvider((window as any).ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      setWalletAddress(accounts[0]);
    } catch (err: any) {
      console.error('Wallet connection failed:', err);
    } finally {
      setConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setDeployedAddress(null);
    setError(null);
  };

  const deployVerifier = async () => {
    if (!(window as any).ethereum) return;
    setDeploying(true);
    setError(null);
    setDeployedAddress(null);
    try {
      const provider = new BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
      const tx = await factory.createVerifier(
        SP1_VERIFIER_ADDRESS,
        PASSPORT_VKEY,
        ageOn,
        ageOn ? minAge : 0,
        nationalityOn,
        nationalityOn ? targetNationality : '',
        genderOn,
        genderOn ? targetSex : ''
      );
      const receipt = await tx.wait();
      const event = receipt.logs
        .map((log: any) => { try { return factory.interface.parseLog(log); } catch { return null; } })
        .find((ev: any) => ev && ev.name === 'VerifierCreated');
      if (event) setDeployedAddress(event.args.verifier);
    } catch (err: any) {
      setError(err.message || 'Deployment failed');
      console.error('Deploy failed:', err);
    } finally {
      setDeploying(false);
    }
  };

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Major+Mono+Display&display=swap');`}</style>
      <div style={{ width: '100vw', height: '100vh', background: '#000', position: 'relative' }}>
        <PixelBlast
          variant="square"
          pixelSize={4}
          color="#00ffff"
          patternScale={2}
          patternDensity={1}
          pixelSizeJitter={0}
          enableRipples
          rippleSpeed={0.4}
          rippleThickness={0.12}
          rippleIntensityScale={1.5}
          liquid={false}
          liquidStrength={0.12}
          liquidRadius={1.2}
          liquidWobbleSpeed={5}
          speed={0.5}
          edgeFade={0.25}
          transparent
        />
        <div
          style={{
            position: 'absolute',
            top: '2rem',
            left: '2rem',
            zIndex: 1,
            background: '#000',
            padding: '0.25rem 0',
          }}
        >
          <GlitchText
            speed={5}
            enableShadows
            enableOnHover={false}
            style={{ fontFamily: "'Major Mono Display', monospace", fontSize: '5rem' }}
          >
            ZK Identity Prover
          </GlitchText>
        </div>
        <p
          style={{
            position: 'absolute',
            top: '9rem',
            left: '2rem',
            color: '#fff',
            fontFamily: "'Major Mono Display', monospace",
            fontSize: '1rem',
            fontWeight: 'bold',
            margin: 0,
            zIndex: 1,
            background: '#000',
            padding: '0.25rem 0',
          }}
        >
          Select your app requirements and deploy your verifier contract
        </p>
        <div
          style={{
            position: 'absolute',
            top: '12rem',
            left: '2rem',
            right: '2rem',
            bottom: 0,
            zIndex: 1,
          }}
        >
          <h2
            style={{
              color: '#fff',
              fontFamily: "'Major Mono Display', monospace",
              fontSize: '2rem',
              margin: '0 0 1rem 0',
            }}
          >
            <span style={{ background: '#000', padding: '0.25rem 0' }}>App Requirements</span>
          </h2>
          <p style={{ color: '#fff', fontFamily: "'Major Mono Display', monospace", fontSize: '1rem', margin: '0 0 1rem 0', fontWeight: 'bold' }}>
            <span style={{ background: '#000', padding: '0.25rem 0' }}>Select one or more requirements</span>
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div onClick={() => setAgeOn(!ageOn)} style={{ flex: 1, background: '#000', border: `1px solid ${ageOn ? '#4ade80' : '#fff'}`, borderRadius: 0, padding: '1.5rem', cursor: 'pointer' }}>
              <h3 style={{ color: '#fff', fontFamily: "'Major Mono Display', monospace", fontSize: '2rem', fontWeight: 'bold', margin: '0 0 1rem 0' }}>Age</h3>
              <p style={{ color: '#fff', fontFamily: "'Major Mono Display', monospace", fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>Enter minimum age</p>
              {ageOn && (
                <input
                  type="number"
                  min={1} max={150}
                  value={minAge}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setMinAge(Number(e.target.value))}
                  style={inputStyle}
                />
              )}
            </div>
            <div onClick={() => setNationalityOn(!nationalityOn)} style={{ flex: 1, background: '#000', border: `1px solid ${nationalityOn ? '#4ade80' : '#fff'}`, borderRadius: 0, padding: '1.5rem', cursor: 'pointer' }}>
              <h3 style={{ color: '#fff', fontFamily: "'Major Mono Display', monospace", fontSize: '2rem', fontWeight: 'bold', margin: '0 0 1rem 0' }}>Nationality</h3>
              <p style={{ color: '#fff', fontFamily: "'Major Mono Display', monospace", fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>Select required nationality</p>
              {nationalityOn && (
                <select
                  value={targetNationality}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setTargetNationality(e.target.value)}
                  style={selectStyle}
                >
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div onClick={() => setGenderOn(!genderOn)} style={{ flex: 1, background: '#000', border: `1px solid ${genderOn ? '#4ade80' : '#fff'}`, borderRadius: 0, padding: '1.5rem', cursor: 'pointer' }}>
              <h3 style={{ color: '#fff', fontFamily: "'Major Mono Display', monospace", fontSize: '2rem', fontWeight: 'bold', margin: '0 0 1rem 0' }}>Gender</h3>
              <p style={{ color: '#fff', fontFamily: "'Major Mono Display', monospace", fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>Select required gender</p>
              {genderOn && (
                <select
                  value={targetSex}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setTargetSex(e.target.value)}
                  style={selectStyle}
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              )}
            </div>
          </div>
          <GlareHover
            background="#000"
            borderColor="#fff"
            borderRadius="0"
            width="auto"
            height="auto"
            glareColor="#ffffff"
            glareOpacity={1}
            glareAngle={-30}
            glareSize={200}
            transitionDuration={2000}
            style={{ marginTop: '1.5rem', display: 'inline-grid', opacity: deploying || !walletAddress ? 0.5 : 1 }}
          >
            <button
              onClick={deployVerifier}
              disabled={deploying || !walletAddress}
              style={{
                padding: '1rem',
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontFamily: "'Major Mono Display', monospace",
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: deploying || !walletAddress ? 'not-allowed' : 'pointer',
              }}
            >
              {deploying ? 'Deploying...' : 'Deploy Contract'}
            </button>
          </GlareHover>
          {error && (
            <p style={{ color: '#f87171', fontFamily: "'Major Mono Display', monospace", fontSize: '0.85rem', marginTop: '1rem' }}>
              {error}
            </p>
          )}
          {deployedAddress && (
            <p style={{ color: '#4ade80', fontFamily: "'Major Mono Display', monospace", fontSize: '0.85rem', marginTop: '1rem' }}>
              Deployed: {deployedAddress}
            </p>
          )}
        </div>

        <GlareHover
          background="#000"
          borderColor="#fff"
          borderRadius="0"
          width="auto"
          height="auto"
          glareColor="#ffffff"
          glareOpacity={1}
          glareAngle={-30}
          glareSize={500}
          transitionDuration={2000}
          style={{ position: 'absolute', top: '2rem', right: '2rem', zIndex: 1, display: 'inline-grid' }}
        >
          <button
            onClick={walletAddress ? disconnectWallet : connectWallet}
            disabled={connecting}
            style={{
              padding: '1rem',
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontFamily: "'Major Mono Display', monospace",
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : (connecting ? 'Connecting...' : 'Connect Wallet')}
          </button>
        </GlareHover>

      </div>
    </>
  );
}

export default App;
