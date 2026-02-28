import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';

const normalizeOption = (option) => {
  if (typeof option === 'string') {
    return { value: option, label: option };
  }

  return {
    value: option?.value ?? '',
    label: option?.label ?? String(option?.value ?? ''),
  };
};

const AppAutocompleteField = ({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Search or select',
  disabled = false,
}) => {
  const normalizedOptions = options.map(normalizeOption);
  const selectedOption = normalizedOptions.find((option) => option.value === value) || null;

  return (
    <div>
      {label && <label className="app-label">{label}</label>}
      <Autocomplete
        options={normalizedOptions}
        value={selectedOption}
        disabled={disabled}
        getOptionLabel={(option) => option?.label || ''}
        isOptionEqualToValue={(option, selected) => option.value === selected.value}
        onChange={(_event, selected) => onChange(selected?.value ?? '')}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={placeholder}
            size="small"
          />
        )}
        sx={{
          '& .MuiOutlinedInput-root': {
            minHeight: 'var(--app-control-height)',
            height: 'var(--app-control-height)',
            borderRadius: 'var(--app-control-radius)',
            backgroundColor: 'var(--app-input-bg)',
            color: 'var(--app-input-text)',
            boxShadow: 'var(--app-control-shadow)',
            paddingRight: '2.25rem',
            '& fieldset': {
              borderColor: 'var(--app-input-border)',
              borderWidth: '1px',
            },
            '&:hover fieldset': {
              borderColor: 'var(--app-input-focus-border)',
            },
            '&.Mui-focused fieldset': {
              borderColor: 'var(--app-input-focus-border)',
            },
          },
          '& .MuiAutocomplete-inputRoot': {
            minHeight: 'var(--app-control-height)',
            paddingTop: '0 !important',
            paddingBottom: '0 !important',
            alignItems: 'center',
          },
          '& .MuiAutocomplete-input': {
            padding: '0 !important',
            height: '1.25rem',
            lineHeight: '1.25rem',
            fontSize: '0.95rem',
          },
          '& .MuiAutocomplete-endAdornment': {
            right: '0.5rem',
          },
          '& .MuiAutocomplete-popupIndicator, & .MuiAutocomplete-clearIndicator': {
            color: 'var(--app-input-text)',
          },
          '& .MuiInputBase-input': {
            fontSize: '0.95rem',
          },
        }}
      />
    </div>
  );
};

export default AppAutocompleteField;
