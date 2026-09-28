variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  type    = string
  default = "velocity-retail"
}

variable "backend_image" {
  description = "Docker image URI (from Docker Hub or ECR) for backend"
  type        = string
}

variable "enable_frontend" {
  description = "Whether to deploy frontend on AWS ECS (Set false when frontend is on Vercel)"
  type        = bool
  default     = false
}

variable "frontend_image" {
  description = "Docker image URI for frontend (only needed if enable_frontend is true)"
  type        = string
  default     = ""
}

variable "mongo_uri" {
  description = "MongoDB Atlas connection string"
  type        = string
  sensitive   = true
}

variable "jwt_access_secret" {
  type      = string
  sensitive = true
}

variable "jwt_refresh_secret" {
  type      = string
  sensitive = true
}

variable "groq_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "cloudinary_cloud_name" {
  type    = string
  default = "yqs5ezyx"
}

variable "cloudinary_api_key" {
  type    = string
  default = "945519752313942"
}

variable "cloudinary_api_secret" {
  type      = string
  sensitive = true
  default   = ""
}
