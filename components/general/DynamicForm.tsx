import React from "react";
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  OutlinedInput,
  InputAdornment,
  IconButton,
  Stack,
  Typography,
  MenuItem,
} from "@mui/material";
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useFormik } from "formik";
import * as Yup from "yup";

type FieldType = "text" | "email" | "password" | "date" | "select" | "textarea";

export interface DynamicField {
  name: string;
  label: string;
  type: FieldType;
  icon?: React.ReactNode;
  showPasswordToggle?: boolean;
  options?: string[]; // For select fields
  multiline?: boolean; // For textarea
  rows?: number; // For textarea
}

interface DynamicFormProps {
  fields: DynamicField[];
  initialValues: Record<string, any>;
  validationSchema: Yup.ObjectSchema<any>;
  onSubmit: (values: Record<string, any>) => void;
  submitLabel: string;
  loading?: boolean;
}

const DynamicForm: React.FC<DynamicFormProps> = ({
  fields,
  initialValues,
  validationSchema,
  onSubmit,
  submitLabel,
  loading = false,
}) => {
  const [showPassword, setShowPassword] = React.useState<Record<string, boolean>>({});

  const handleTogglePassword = (field: string) => {
    setShowPassword(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const formik = useFormik({
    initialValues,
    validationSchema,
    onSubmit,
  });

  return (
    <form onSubmit={formik.handleSubmit} noValidate>
      <Stack spacing={3}>
        {fields.map(field => (
          <FormControl key={field.name} fullWidth variant="outlined">
            {field.type === "password" ? (
              <>
                <InputLabel
                  htmlFor={field.name}
                  error={Boolean(formik.touched[field.name] && formik.errors[field.name])}
                >
                  {field.label}
                </InputLabel>
                <OutlinedInput
                  id={field.name}
                  name={field.name}
                  type={showPassword[field.name] ? "text" : "password"}
                  value={formik.values[field.name]}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  startAdornment={
                    <InputAdornment position="start">
                      {field.icon}
                    </InputAdornment>
                  }
                  endAdornment={
                    field.showPasswordToggle && (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => handleTogglePassword(field.name)}
                          edge="end"
                          aria-label="toggle password visibility"
                        >
                          {showPassword[field.name] ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }
                  label={field.label}
                  error={Boolean(formik.touched[field.name] && formik.errors[field.name])}
                />
                {formik.touched[field.name] && formik.errors[field.name] && (
                  <Typography variant="caption" color="error">
                    {formik.errors[field.name]}
                  </Typography>
                )}
              </>
            ) : field.type === "select" ? (
              <TextField
                select
                id={field.name}
                name={field.name}
                label={field.label}
                value={formik.values[field.name]}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={Boolean(formik.touched[field.name] && formik.errors[field.name])}
                helperText={formik.touched[field.name] && formik.errors[field.name]}
                variant="outlined"
                fullWidth
              >
                {field.options?.map(option => (
                  <MenuItem key={option} value={option}>{option}</MenuItem>
                ))}
              </TextField>
            ) : field.type === "date" ? (
              <TextField
                id={field.name}
                name={field.name}
                label={field.label}
                type="datetime-local"
                value={formik.values[field.name]}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={Boolean(formik.touched[field.name] && formik.errors[field.name])}
                helperText={formik.touched[field.name] && formik.errors[field.name]}
                variant="outlined"
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            ) : field.type === "textarea" ? (
              <TextField
                id={field.name}
                name={field.name}
                label={field.label}
                type="text"
                value={formik.values[field.name]}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                multiline
                rows={field.rows || 3}
                error={Boolean(formik.touched[field.name] && formik.errors[field.name])}
                helperText={formik.touched[field.name] && formik.errors[field.name]}
                variant="outlined"
                fullWidth
              />
            ) : (
              <TextField
                id={field.name}
                name={field.name}
                label={field.label}
                type={field.type}
                value={formik.values[field.name]}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                InputProps={{
                  startAdornment: field.icon ? (
                    <InputAdornment position="start">{field.icon}</InputAdornment>
                  ) : undefined,
                }}
                error={Boolean(formik.touched[field.name] && formik.errors[field.name])}
                helperText={formik.touched[field.name] && formik.errors[field.name]}
                variant="outlined"
                fullWidth
              />
            )}
          </FormControl>
        ))}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px",
            borderRadius: "8px",
            background: "#00B9B9",
            color: "#fff",
            fontWeight: "bold",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "1rem"
          }}
        >
          {loading ? "Processing..." : submitLabel}
        </button>
      </Stack>
    </form>
  );
};

export default DynamicForm;