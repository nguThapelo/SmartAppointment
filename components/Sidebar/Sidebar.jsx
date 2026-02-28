import React, { useState } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
  useMediaQuery,
} from '@mui/material';
import {
  MdHome,
  MdDashboard
} from 'react-icons/md';
import {
  IoLibraryOutline,
  IoPersonCircleOutline,
} from 'react-icons/io5';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useRouter } from 'next/router';

const theme = createTheme({
  palette: {
    primary: {
      main: '#25D366', // WhatsApp Green
    },
  },
});

const Sidebar = () => {
  const [open, setOpen] = useState(true);
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 500px)');

  const toggleDrawer = () => {
    setOpen(!open);
  };

  const handleNavigation = (path) => {
    router.push(path);
  };

  const menuItems = [
    { 
      text: 'Home', 
      icon: <MdHome size={24} />, 
      path: '/',
      bgColor: '#1e6091', // WhatsApp Green
      hoverColor: '#1e6091'
    },
    { 
      text: 'Dashboard', 
      icon: <MdDashboard size={24} />, 
      path: '/Dashboard',
      bgColor: '#25D366', // WhatsApp Green
      hoverColor: '#128C7E'
    },
    { 
      text: 'Library', 
      icon: <IoLibraryOutline size={24} />, 
      path: '/Library',
      bgColor: '#34B7F1', // Bright Blue
      hoverColor: '#2196F3'
    },
    { 
      text: 'Profile', 
      icon: <IoPersonCircleOutline size={24} />, 
      path: '/Profile',
      bgColor: '#FF6B6B', // Vibrant Red
      hoverColor: '#F44336'
    },
  ];

  return (
    <ThemeProvider theme={theme}>
      <Box display="flex">
        <Drawer
          variant="persistent"
          anchor="left"
          open={open}
          sx={{
            width: 260,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 260,
              background: 'linear-gradient(135deg, #075E54 0%, #128C7E 50%, #25D366 100%)',
              borderRight: 'none',
              boxShadow: '4px 0 20px rgba(37, 211, 102, 0.3)',
              overflow: 'hidden',
            },
          }}
        >
          {/* Logo Section */}
          {/* <Box 
            p={3} 
            textAlign="center" 
            sx={{ 
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <img
              src="/images/Earth.png"
              alt="System Logo"
              style={{ 
                width: '70%', 
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
              }}
            />
          </Box> */}

          {/* Menu Items */}
          <List sx={{ mt: 4, px: 1.5 }}>
            {menuItems.map((item) => (
              <ListItem
                button
                key={item.text}
                onClick={() => handleNavigation(item.path)}
                sx={{
                  // mx: 1.5,
                  mb: 1.5,
                  borderRadius: '16px',
                  background: `linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)`,
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: 'pointer',
                  
                  // Hover Effects
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    background: `linear-gradient(135deg, ${item.hoverColor}20 0%, ${item.bgColor}10 100%)`,
                    boxShadow: `0 12px 40px ${item.bgColor}30, 0 4px 20px rgba(0, 0, 0, 0.2)`,
                    borderColor: `rgba(255, 255, 255, 0.4)`,
                  },
                  
                  // Active/Selected State
                  '&.Mui-selected': {
                    background: `${item.bgColor}20`,
                    boxShadow: `0 8px 32px ${item.bgColor}40`,
                  },
                }}
              >
                <ListItemIcon sx={{ 
                  minWidth: 48,
                  color: 'white',
                  '& svg': {
                    fontSize: 24,
                  }
                }}>
                  {React.cloneElement(item.icon, { 
                    style: { 
                      background: `linear-gradient(135deg, ${item.bgColor}, ${item.hoverColor})`,
                      borderRadius: '12px',
                      padding: '8px',
                      boxShadow: `0 4px 16px ${item.bgColor}40`
                    } 
                  })}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: 600,
                    color: 'white',
                    fontSize: '1rem',
                  }}
                />
              </ListItem>
            ))}
          </List>

          {/* Bottom gradient overlay */}
          <Box 
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '60px',
              background: 'linear-gradient(transparent, rgba(37, 211, 102, 0.4))',
              pointerEvents: 'none',
            }}
          />
        </Drawer>
      </Box>
    </ThemeProvider>
  );
};

export default Sidebar;
