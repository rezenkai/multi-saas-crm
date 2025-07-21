package com.backend.core.user

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.util.*

@Repository
interface UserRepository : JpaRepository<UserEntity, UUID> {

    fun findByEmail(email: String): UserEntity?

    @Query("SELECT u FROM UserEntity u WHERE u.email = :email AND u.isActive = true")
    fun findActiveByEmail(@Param("email") email: String): UserEntity?

    fun findByUsername(username: String): UserEntity?

    fun existsByEmail(email: String): Boolean

    fun existsByUsername(username: String): Boolean

    @Query("SELECT u FROM UserEntity u WHERE u.isActive = true")
    fun findAllActive(): List<UserEntity>

    @Query("SELECT u FROM UserEntity u WHERE u.isSuperuser = true")
    fun findAllSuperusers(): List<UserEntity>

    @Query("SELECT u FROM UserEntity u WHERE u.isVerified = false")
    fun findAllUnverified(): List<UserEntity>

    @Query("SELECT u FROM UserEntity u WHERE " +
            "LOWER(u.firstName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(u.lastName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(u.username) LIKE LOWER(CONCAT('%', :search, '%'))")
    fun searchUsers(@Param("search") search: String): List<UserEntity>

    fun countByIsActive(isActive: Boolean): Long

    fun countByIsVerified(isVerified: Boolean): Long
}