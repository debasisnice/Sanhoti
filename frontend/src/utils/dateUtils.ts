/**
 * Converts a PST date string to the user's local timezone
 * 
 * @param dateString - Date string in PST (can be date-only like "2025-07-19" or ISO string)
 * @returns Date object in user's local timezone
 */
export function convertPSTToLocal(dateString: string): Date {
  if (!dateString) {
    return new Date();
  }

  // Check if it's a date-only string (YYYY-MM-DD format)
  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
  
  if (dateOnlyPattern.test(dateString)) {
    // For date-only strings, assume they represent midnight PST
    // PST is UTC-8, PDT is UTC-7
    // We need to determine if it's PST or PDT based on the date
    // For simplicity, we'll check if DST is likely in effect (roughly March-November)
    const [year, month] = dateString.split('-').map(Number);
    const isDST = month >= 3 && month <= 11; // Rough DST period (March to November)
    const offset = isDST ? '-07:00' : '-08:00'; // PDT or PST
    
    const pstDateString = `${dateString}T00:00:00${offset}`;
    return new Date(pstDateString);
  } else {
    // For ISO strings with timezone info, parse directly
    if (dateString.includes('Z') || dateString.match(/[+-]\d{2}:\d{2}$/)) {
      return new Date(dateString);
    }
    
    // For ISO strings without timezone, assume PST/PDT
    // Try to detect if it has time component
    if (dateString.includes('T')) {
      // Has time component, append PST/PDT offset
      const datePart = dateString.split('T')[0];
      const [year, month] = datePart.split('-').map(Number);
      const isDST = month >= 3 && month <= 11;
      const offset = isDST ? '-07:00' : '-08:00';
      return new Date(`${dateString}${offset}`);
    }
    
    // Fallback: parse as-is
    return new Date(dateString);
  }
}

