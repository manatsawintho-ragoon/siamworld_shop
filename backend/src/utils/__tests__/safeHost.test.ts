import { isPrivateAddress } from '../safeHost';

describe('isPrivateAddress', () => {
  it('blocks the internal ranges an RCON host must never reach', () => {
    const blocked = [
      '127.0.0.1',        // loopback
      '10.0.0.5',         // RFC1918
      '172.17.0.2',       // docker bridge
      '172.31.255.254',   // top of the RFC1918 /12
      '192.168.1.10',     // RFC1918
      '169.254.169.254',  // cloud metadata
      '0.0.0.0',
      '224.0.0.1',        // multicast
      '::1',
      'fe80::1',
      'fd00::1',
      '::ffff:10.0.0.1',  // IPv4-mapped private must be judged on the v4 part
    ];
    for (const ip of blocked) {
      expect([ip, isPrivateAddress(ip)]).toEqual([ip, true]);
    }
  });

  it('allows ordinary public addresses', () => {
    const allowed = ['49.231.43.185', '8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '2404:6800:4004::1'];
    for (const ip of allowed) {
      expect([ip, isPrivateAddress(ip)]).toEqual([ip, false]);
    }
  });

  it('allows the Tailscale range — it is the sanctioned RCON transport', () => {
    // yokaicraft's RCON lives on 100.119.2.16. Treating 100.64/10 as CGNAT and
    // blocking it would break a live shop, and it buys nothing: tailnet addresses
    // do not route to the Docker-internal services this guard protects.
    expect(isPrivateAddress('100.119.2.16')).toBe(false);
    expect(isPrivateAddress('100.77.102.23')).toBe(false);
  });

  it('rejects anything that is not an IP literal', () => {
    expect(isPrivateAddress('not-an-ip')).toBe(true);
    expect(isPrivateAddress('')).toBe(true);
  });
});
