import {
  createContext,
  useContext,
  useEffect,
  useState
} from 'react';

import {
  fetchCurrentUser,
  logoutUser
} from '../api/authApi';


const AuthContext =
  createContext(null);


// ============================================================
// AUTH PROVIDER
// ============================================================

export function AuthProvider({ children }) {

  // ==========================================================
  // STATE
  // ==========================================================

  const [user, setUser] =
    useState(null);

  const [token, setToken] =
    useState(
      () => localStorage.getItem('token')
    );

  const [loading, setLoading] =
    useState(true);


  // ==========================================================
  // SESSION HYDRATION
  //
  // Runs when the application starts.
  //
  // If a JWT exists:
  //
  // localStorage
  //      ↓
  // fetchCurrentUser()
  //      ↓
  // backend validates JWT
  //      ↓
  // current user returned
  // ==========================================================

  useEffect(() => {

    let mounted = true;

    async function hydrateSession() {

      const storedToken =
        localStorage.getItem('token');

      // ------------------------------------------------------
      // No token means no authenticated session.
      // ------------------------------------------------------

      if (!storedToken) {

        if (mounted) {
          setToken(null);
          setUser(null);
          setLoading(false);
        }

        return;
      }

      // ------------------------------------------------------
      // Token exists.
      //
      // axiosClient automatically sends it in the
      // Authorization header.
      // ------------------------------------------------------

      try {

        const data =
          await fetchCurrentUser();

        if (!mounted) {
          return;
        }

        if (!data?.user) {
          throw new Error(
            'Invalid current-user response'
          );
        }

        setUser(data.user);

        setToken(storedToken);

      } catch (err) {

        if (!mounted) {
          return;
        }

        console.error(
          '[AUTH] Session hydration failed:',
          err.message
        );

        // ----------------------------------------------------
        // JWT is invalid/expired OR the account is no longer
        // valid.
        // ----------------------------------------------------

        localStorage.removeItem('token');

        setToken(null);
        setUser(null);

      } finally {

        if (mounted) {
          setLoading(false);
        }

      }
    }

    hydrateSession();

    return () => {
      mounted = false;
    };

  }, []);


  // ==========================================================
  // LOGIN
  //
  // Called after successful login.
  // ==========================================================

  function login(newToken, userData) {

    if (!newToken) {
      throw new Error(
        'Authentication token is required'
      );
    }

    localStorage.setItem(
      'token',
      newToken
    );

    setToken(newToken);

    setUser(
      userData || null
    );
  }


  // ==========================================================
  // UPDATE USER
  //
  // Controlled way for pages such as ProfilePage to update
  // user information in the global auth state.
  // ==========================================================

  function updateUser(updatedUser) {

    if (!updatedUser) {
      return;
    }

    setUser(
      (previousUser) => ({
        ...(previousUser || {}),
        ...updatedUser
      })
    );
  }


  // ==========================================================
  // LOGOUT
  //
  // The JWT is removed locally.
  //
  // We also attempt the backend logout endpoint, but logout
  // must still succeed locally if that request fails.
  // ==========================================================

  async function logout() {

    try {

      if (token) {
        await logoutUser();
      }

    } catch (err) {

      console.warn(
        '[AUTH] Backend logout request failed:',
        err.message
      );

    } finally {

      localStorage.removeItem(
        'token'
      );

      setToken(null);
      setUser(null);

    }
  }


  // ==========================================================
  // AUTH CONTEXT VALUE
  // ==========================================================

  const value = {
    user,
    token,
    loading,

    login,
    logout,
    updateUser
  };


  // ==========================================================
  // PROVIDER
  // ==========================================================

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}


// ============================================================
// USE AUTH
// ============================================================

export function useAuth() {

  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }

  return context;
}