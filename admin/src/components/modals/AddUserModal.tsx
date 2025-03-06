import React, { useEffect, useState } from 'react'
import { ModalLayout, ModalBody, ModalHeader, ModalFooter } from '@strapi/design-system/ModalLayout'
import { Button } from '@strapi/design-system/Button'
import { TextInput } from '@strapi/design-system/TextInput'
import { Typography } from '@strapi/design-system/Typography'
import { request } from '@strapi/helper-plugin'
import { Option, Select } from '@strapi/design-system/Select'
import { User } from '../../types'

interface AddUserModalProps {
  isOpen: boolean
  onClose: () => void
  selectedUserEmail: string
  setSelectedUserEmail: (email: string) => void
  onSave: () => void
  existingUsers: User[]
}

const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  selectedUserEmail,
  setSelectedUserEmail,
  onSave,
  existingUsers
}) => {
  if (!isOpen) return null

  const [users, setUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchUsers = async () => {
      const usersData = await request('/stripe-payment/admin/users', { method: 'GET' })
      setUsers(usersData)
    }

    if (isOpen) {
      fetchUsers()
    }
  }, [isOpen])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handleClose = () => {
    onClose()
  }

  const handleSave = () => {
    onSave()
  }

  const handleUserEmailChange = (value: string) => {
    setSelectedUserEmail(value)
  }

  const filteredUsers = users
    .filter((user) => !existingUsers.some((orgUser) => orgUser.email === user.email))
    .filter((user) => user.email.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <ModalLayout onClose={handleClose} labelledBy="Add new user">
      <ModalHeader>
        <Typography fontWeight="bold" textColor="neutral800" as="h2" id="Add new user">
          Add new user
        </Typography>
      </ModalHeader>
      <ModalBody>
        <TextInput
          label="Search User"
          name="searchUser"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Enter email to search..."
        />
        <Select label="Select User" name="selectUser" value={selectedUserEmail} onChange={handleUserEmailChange}>
          {filteredUsers.map((user) => (
            <Option key={user.id} value={user.email}>
              {user.email}
            </Option>
          ))}
        </Select>
      </ModalBody>
      <ModalFooter
        startActions={
          <Button onClick={handleClose} variant="tertiary">
            Cancel
          </Button>
        }
        endActions={<Button onClick={handleSave}>Add user</Button>}
      />
    </ModalLayout>
  )
}

export default AddUserModal
