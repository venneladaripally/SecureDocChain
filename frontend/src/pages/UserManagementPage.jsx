import {
  useState,
  useEffect,
  useCallback
} from 'react';

import {
  fetchUsers,
  createUser,
  changeUserRole,
  setUserStatus
} from '../api/adminApi';

import Sidebar from '../components/Sidebar';


// ============================================================
// VALID ROLES
// ============================================================

const ROLES = [
  'admin',
  'engineer',
  'reviewer',
  'auditor',
  'viewer'
];


function UserManagementPage() {

  // ==========================================================
  // USERS
  // ==========================================================

  const [users, setUsers] =
    useState([]);

  const [search, setSearch] =
    useState('');


  // ==========================================================
  // UI STATE
  // ==========================================================

  const [loading, setLoading] =
    useState(true);

  const [creating, setCreating] =
    useState(false);

  const [updatingUserId, setUpdatingUserId] =
    useState(null);

  const [error, setError] =
    useState('');

  const [message, setMessage] =
    useState('');


  // ==========================================================
  // CREATE USER FORM
  // ==========================================================

  const [fullName, setFullName] =
    useState('');

  const [username, setUsername] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [role, setRole] =
    useState('viewer');


  // ==========================================================
  // LOAD USERS
  // ==========================================================

  const load = useCallback(
    async () => {

      setLoading(true);
      setError('');

      try {

        const data =
          await fetchUsers(search);

        if (!data?.success) {
          throw new Error(
            data?.message ||
            'Failed to load users.'
          );
        }

        setUsers(
          Array.isArray(data.users)
            ? data.users
            : []
        );

      } catch (err) {

        console.error(
          '[USER MANAGEMENT] Failed to load users:',
          err.message
        );

        setError(
          err.response?.data?.message ||
          err.message ||
          'Failed to load users.'
        );

      } finally {

        setLoading(false);

      }
    },
    [search]
  );


  // ==========================================================
  // INITIAL LOAD / SEARCH
  // ==========================================================

  useEffect(() => {

    load();

  }, [load]);


  // ==========================================================
  // CREATE USER
  // ==========================================================

  async function handleCreate(e) {

    e.preventDefault();

    setError('');
    setMessage('');

    if (creating) {
      return;
    }


    // --------------------------------------------------------
    // Client-side validation
    // --------------------------------------------------------

    if (
      !fullName.trim() ||
      !username.trim() ||
      !email.trim() ||
      !password
    ) {

      setError(
        'All user fields are required.'
      );

      return;
    }


    if (password.length < 8) {

      setError(
        'Password must be at least 8 characters long.'
      );

      return;
    }


    if (!ROLES.includes(role)) {

      setError(
        'Please select a valid role.'
      );

      return;
    }


    setCreating(true);

    try {

      const data =
        await createUser(
          fullName.trim(),
          username.trim(),
          email.trim(),
          password,
          role
        );


      if (!data?.success) {
        throw new Error(
          data?.message ||
          'Failed to create user.'
        );
      }


      // ------------------------------------------------------
      // Reset form
      // ------------------------------------------------------

      setFullName('');
      setUsername('');
      setEmail('');
      setPassword('');
      setRole('viewer');


      setMessage(
        'User created successfully. The user will be required to set a security question and answer when they first sign in.'
      );


      // ------------------------------------------------------
      // Refresh list
      // ------------------------------------------------------

      await load();

    } catch (err) {

      console.error(
        '[USER MANAGEMENT] Create user failed:',
        err.message
      );

      setError(
        err.response?.data?.message ||
        err.message ||
        'Failed to create user.'
      );

    } finally {

      setCreating(false);

    }
  }


  // ==========================================================
  // CHANGE ROLE
  // ==========================================================

  async function handleRoleChange(
    id,
    newRole
  ) {

    setError('');
    setMessage('');

    if (!id || !ROLES.includes(newRole)) {

      setError(
        'Invalid user or role.'
      );

      return;
    }


    setUpdatingUserId(id);

    try {

      const data =
        await changeUserRole(
          id,
          newRole
        );


      if (!data?.success) {
        throw new Error(
          data?.message ||
          'Failed to change role.'
        );
      }


      setMessage(
        `Role updated to ${newRole}.`
      );


      await load();

    } catch (err) {

      console.error(
        '[USER MANAGEMENT] Role change failed:',
        err.message
      );

      setError(
        err.response?.data?.message ||
        err.message ||
        'Failed to change role.'
      );

      // Refresh so the UI does not display
      // an incorrect role after a failed request.
      await load();

    } finally {

      setUpdatingUserId(null);

    }
  }


  // ==========================================================
  // ACTIVATE / DEACTIVATE USER
  // ==========================================================

  async function handleToggleActive(
    id,
    isActive,
    username
  ) {

    setError('');
    setMessage('');


    if (!id) {

      setError(
        'Invalid user ID.'
      );

      return;
    }


    const newStatus =
      !isActive;


    // --------------------------------------------------------
    // Confirmation before deactivation
    // --------------------------------------------------------

    if (
      isActive &&
      !window.confirm(
        `Are you sure you want to deactivate ${
          username || 'this user'
        }?`
      )
    ) {
      return;
    }


    setUpdatingUserId(id);

    try {

      const data =
        await setUserStatus(
          id,
          newStatus
        );


      if (!data?.success) {
        throw new Error(
          data?.message ||
          'Failed to update user status.'
        );
      }


      setMessage(
        `User ${
          newStatus
            ? 'activated'
            : 'deactivated'
        } successfully.`
      );


      await load();

    } catch (err) {

      console.error(
        '[USER MANAGEMENT] Status update failed:',
        err.message
      );

      setError(
        err.response?.data?.message ||
        err.message ||
        'Failed to update user status.'
      );

      await load();

    } finally {

      setUpdatingUserId(null);

    }
  }


  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="dashboard">

      <Sidebar />


      <main className="dashboard-main">

        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <header className="dashboard-header">

          <div className="dashboard-title">

            <h1>
              User Management
            </h1>

            <p>
              Create users, assign roles,
              activate/deactivate accounts.
            </p>

          </div>


          <button
            type="button"
            className="upload-button"
            onClick={load}
            disabled={loading}
          >
            {loading
              ? 'Loading...'
              : 'Refresh'}
          </button>

        </header>


        <div className="dashboard-content">

          {/* ================================================= */}
          {/* ERROR */}
          {/* ================================================= */}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}


          {/* ================================================= */}
          {/* SUCCESS */}
          {/* ================================================= */}

          {message && (
            <div className="success-message">
              {message}
            </div>
          )}


          {/* ================================================= */}
          {/* CREATE USER */}
          {/* ================================================= */}

          <div className="content-card">

            <div className="content-card-header">

              <div>

                <h2>
                  Create user
                </h2>

              </div>

            </div>


            <div className="content-card-body">

              <form
                onSubmit={handleCreate}
                className="upload-form"
              >

                {/* FULL NAME */}

                <div className="form-group">

                  <label htmlFor="fullName">
                    Full name
                  </label>

                  <input
                    id="fullName"
                    className="form-input"
                    type="text"
                    value={fullName}
                    onChange={(e) =>
                      setFullName(
                        e.target.value
                      )
                    }
                    maxLength={150}
                    autoComplete="name"
                    required
                  />

                </div>


                {/* USERNAME */}

                <div className="form-group">

                  <label htmlFor="username">
                    Username
                  </label>

                  <input
                    id="username"
                    className="form-input"
                    type="text"
                    value={username}
                    onChange={(e) =>
                      setUsername(
                        e.target.value
                      )
                    }
                    maxLength={50}
                    autoComplete="username"
                    required
                  />

                </div>


                {/* EMAIL */}

                <div className="form-group">

                  <label htmlFor="email">
                    Email
                  </label>

                  <input
                    id="email"
                    className="form-input"
                    type="email"
                    value={email}
                    onChange={(e) =>
                      setEmail(
                        e.target.value
                      )
                    }
                    maxLength={150}
                    autoComplete="email"
                    required
                  />

                </div>


                {/* PASSWORD */}

                <div className="form-group">

                  <label htmlFor="password">
                    Temporary password
                  </label>

                  <input
                    id="password"
                    className="form-input"
                    type="password"
                    value={password}
                    onChange={(e) =>
                      setPassword(
                        e.target.value
                      )
                    }
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                  />

                  <small>
                    Minimum 8 characters.
                  </small>

                </div>


                {/* ROLE */}

                <div className="form-group">

                  <label htmlFor="role">
                    Role
                  </label>

                  <select
                    id="role"
                    className="form-input"
                    value={role}
                    onChange={(e) =>
                      setRole(
                        e.target.value
                      )
                    }
                    disabled={creating}
                  >

                    {ROLES.map(
                      (item) => (

                        <option
                          key={item}
                          value={item}
                        >
                          {item}
                        </option>

                      )
                    )}

                  </select>

                </div>


                {/* SUBMIT */}

                <button
                  className="upload-button"
                  type="submit"
                  disabled={creating}
                >
                  {creating
                    ? 'Creating user...'
                    : 'Create user'}
                </button>

              </form>

            </div>

          </div>


          {/* ================================================= */}
          {/* USERS */}
          {/* ================================================= */}

          <div className="content-card">

            <div className="content-card-header">

              <div>

                <h2>
                  All users
                </h2>

              </div>


              <input
                className="form-input"
                type="search"
                placeholder="Search users"
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                maxLength={100}
                style={{
                  maxWidth: '240px'
                }}
              />

            </div>


            <div className="content-card-body">

              {/* LOADING */}

              {loading ? (

                <p>
                  Loading users...
                </p>

              ) : users.length === 0 ? (

                <p>
                  No users found.
                </p>

              ) : (

                <div
                  style={{
                    overflowX: 'auto'
                  }}
                >

                  <table className="document-table">

                    <thead>

                      <tr>

                        <th>
                          Name
                        </th>

                        <th>
                          Username
                        </th>

                        <th>
                          Email
                        </th>

                        <th>
                          Role
                        </th>

                        <th>
                          Status
                        </th>

                        <th>
                          Actions
                        </th>

                      </tr>

                    </thead>


                    <tbody>

                      {users.map(
                        (u) => {

                          const isUpdating =
                            updatingUserId ===
                            u.id;


                          return (

                            <tr
                              key={u.id}
                            >

                              {/* NAME */}

                              <td>
                                {u.full_name}
                              </td>


                              {/* USERNAME */}

                              <td>
                                {u.username}
                              </td>


                              {/* EMAIL */}

                              <td>
                                {u.email}
                              </td>


                              {/* ROLE */}

                              <td>

                                <select
                                  className="form-input"
                                  value={
                                    u.role_name
                                  }
                                  onChange={(e) =>
                                    handleRoleChange(
                                      u.id,
                                      e.target.value
                                    )
                                  }
                                  disabled={
                                    isUpdating
                                  }
                                  style={{
                                    padding:
                                      '6px'
                                  }}
                                >

                                  {ROLES.map(
                                    (item) => (

                                      <option
                                        key={item}
                                        value={item}
                                      >
                                        {item}
                                      </option>

                                    )
                                  )}

                                </select>

                              </td>


                              {/* STATUS */}

                              <td>

                                {u.is_active
                                  ? 'Active'
                                  : 'Deactivated'}

                              </td>


                              {/* ACTION */}

                              <td>

                                <button
                                  type="button"
                                  className="download-button"
                                  onClick={() =>
                                    handleToggleActive(
                                      u.id,
                                      u.is_active,
                                      u.username
                                    )
                                  }
                                  disabled={
                                    isUpdating
                                  }
                                >

                                  {isUpdating
                                    ? 'Updating...'
                                    : u.is_active
                                      ? 'Deactivate'
                                      : 'Activate'}

                                </button>

                              </td>

                            </tr>

                          );

                        }
                      )}

                    </tbody>

                  </table>

                </div>

              )}

            </div>

          </div>

        </div>

      </main>

    </div>
  );
}


export default UserManagementPage;