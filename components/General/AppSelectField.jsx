import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';

const normalizeOption = (option) => {
  if (typeof option === 'string') {
    return { value: option, label: option };
  }

  return {
    value: option?.value ?? '',
    label: option?.label ?? String(option?.value ?? ''),
  };
};

const AppSelectField = ({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  disabled = false,
}) => {
  const normalizedOptions = options.map(normalizeOption);

  return (
    <div>
      {label && <label className="app-label">{label}</label>}
      <FormControl fullWidth disabled={disabled}>
      <Select
        value={value ?? ''}
        displayEmpty
        onChange={(event) => onChange(event.target.value)}
        sx={{
          minHeight: 'var(--app-control-height)',
          height: 'var(--app-control-height)',
          borderRadius: 'var(--app-control-radius)',
          backgroundColor: 'var(--app-input-bg)',
          color: 'var(--app-input-text)',
          boxShadow: 'var(--app-control-shadow)',
          '& .MuiSelect-select': {
            display: 'flex',
            alignItems: 'center',
            minHeight: 'var(--app-control-height) !important',
            paddingTop: 0,
            paddingBottom: 0,
            fontSize: '0.95rem',
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--app-input-border)',
            borderWidth: '1px',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--app-input-focus-border)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--app-input-focus-border)',
            boxShadow: '0 0 0 3px var(--app-input-focus-ring)',
          },
        }}
      >
        <MenuItem value="">{placeholder}</MenuItem>
        {normalizedOptions.map((option) => (
          <MenuItem key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
      </FormControl>
    </div>
  );
};

export default AppSelectField;
