// useAdminHierarchy.ts
//
// Loads the three Directory datasets (locations, clinics, users) once and builds
// the containment forest. Shared by AdminHierarchyTree (the navigator) and
// AdminDirectoryRoster (the selected-node body) so both render from ONE built
// hierarchy — no divergence, no double-build. Refetches on the clinics/users
// invalidation generations (locations are near-static + self-cached).
import { useState, useEffect, useCallback, useMemo } from 'react'
import { listClinics, listAllUsers, listLocations } from '../../lib/adminService'
import type { AdminClinic, AdminLocation, AdminUser } from '../../lib/adminService'
import { useInvalidation } from '../../stores/useInvalidationStore'
import { buildAdminHierarchy, type AdminHierarchy } from './adminHierarchy'

export function useAdminHierarchy(): { hierarchy: AdminHierarchy; loading: boolean } {
    const gen = useInvalidation('clinics', 'users')
    const [clinics, setClinics] = useState<AdminClinic[]>([])
    const [users, setUsers] = useState<AdminUser[]>([])
    const [locations, setLocations] = useState<AdminLocation[]>([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        setLoading(true)
        const [c, u, l] = await Promise.all([listClinics(), listAllUsers(), listLocations()])
        setClinics(c)
        setUsers(u)
        setLocations(l)
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load, gen])

    const hierarchy = useMemo(
        () => buildAdminHierarchy(locations, clinics, users),
        [locations, clinics, users],
    )

    return { hierarchy, loading }
}
