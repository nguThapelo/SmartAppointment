import React from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Button,
  Avatar,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { useRouter } from "next/router";

interface NavbarProps {
  email?: string;
  onLogout?: () => void;
  menuItems: { label: string; href: string }[];
}

const Navbar: React.FC<NavbarProps> = ({ email, onLogout, menuItems }) => {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  const handleMenuClick = (href: string) => {
    router.push(href);
    handleMenuClose();
  };

  return (
    <AppBar position="static" color="default" elevation={2}>
      <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
        {/* Left: Dropdown Menu */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={handleMenuOpen}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            {menuItems.map(item => (
              <MenuItem key={item.href} onClick={() => handleMenuClick(item.href)}>
                {item.label}
              </MenuItem>
            ))}
          </Menu>
          <Typography variant="h6" sx={{ fontWeight: "bold", ml: 1 }}>
            SmartAppointment
          </Typography>
        </Box>
        {/* Right: Avatar and Logout */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          {email && (
            <Avatar sx={{ bgcolor: "#0077c2" }}>
              {email.charAt(0).toUpperCase()}
            </Avatar>
          )}
          <Button
            color="error"
            variant="outlined"
            onClick={onLogout}
            sx={{ fontWeight: "bold" }}
          >
            Logout
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;