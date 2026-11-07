import { useMemo, useState } from 'react';
import { useMapPoints, type MapPin } from '../../data/mapPoints';
import { FOCUS } from '../homes/ui';
import { Button, Field, Input } from '../ui';

const MAX_MATCHES = 6;

export type ListingChoice = MapPin & { address: string };

/** The points file has no address column, but a market id ends in the address: `market:for_sale:12-N-Main-St,-Provo,-UT-84601`. */
function withAddress(pin: MapPin): ListingChoice | null {
  const slug = /^market:for_(?:sale|rent):(.+)$/.exec(pin.id)?.[1];
  return slug ? { ...pin, address: slug.replace(/-/g, ' ') } : null;
}

/** Display only: the server rebuilds the address and price from the listing itself. */
export const listingSummary = ({ address, value, rent }: ListingChoice) =>
  `${address}, ${rent ? `$${rent.toLocaleString('en-US')}/mo` : `$${value?.toLocaleString('en-US')}`}`;

type Props = { value: ListingChoice | null; onChange: (listing: ListingChoice | null) => void };

/** Searches the static map points in the browser, so typing costs no Convex read. */
export default function AdListingPicker({ value, onChange }: Props) {
  const homes = useMapPoints('home');
  const apartments = useMapPoints('apartment');
  const [search, setSearch] = useState('');
  // shortcut: the 31 apartments with non-market ids have no address to search by, add an address column to the points file to reach them.
  const all = useMemo(() => [...(homes ?? []), ...(apartments ?? [])].flatMap(p => withAddress(p) ?? []), [homes, apartments]);
  const needle = search.trim().toLowerCase();
  const matches = useMemo(() => {
    if (needle.length < 2) return [];
    return all.filter(l => l.address.toLowerCase().includes(needle)).slice(0, MAX_MATCHES);
  }, [all, needle]);

  if (value) {
    return (
      <div className="rounded-control bg-surface-sunken p-3">
        <p className="text-small font-semibold text-text">Sponsoring</p>
        <p className="mt-1 break-words text-small text-text">{listingSummary(value)}</p>
        <p className="mt-1 text-caption text-text-muted">Your ad sits at this address, and a click opens this listing.</p>
        <Button variant="secondary" size="sm" className="mt-2" onClick={() => onChange(null)}>Choose another</Button>
      </div>
    );
  }
  return (
    <div>
      <Field label="Find a home or apartment" hint="Search by street, town or ZIP.">
        <Input type="search" autoComplete="off" value={search} onChange={e => setSearch(e.target.value)} placeholder="123 Main St" />
      </Field>
      {matches.length > 0 && (
        <ul aria-label="Matching listings" className="mt-2 space-y-1">
          {matches.map(l => (
            <li key={l.id}>
              <button type="button" onClick={() => onChange(l)} className={`min-h-11 w-full break-words rounded-control border border-border px-3 py-2 text-left text-small text-text hover:bg-surface-sunken ${FOCUS}`}>
                {listingSummary(l)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {needle.length >= 2 && !matches.length && <p role="status" className="mt-2 text-caption text-text-muted">{homes && apartments ? 'No listings match that search.' : 'Loading listings'}</p>}
    </div>
  );
}
