import React from "react"
import { Flex, Input } from "@chakra-ui/react"

const ApplicationPage = () => {
  return (
   <Flex align="center" justify="center" direction="column" height="100vh">
   <div>
    <h1>User Application Page</h1>
    <p>Application form will go here.</p>
    <Input placeholder="First Name" />
    <Input placeholder="Last Name" />
    <Input placeholder="Graduation Year" type="number" />
    <Input placeholder="Email" />
    <Input placeholder="Major" />
   </div>
  </Flex>
  )
}

export default ApplicationPage