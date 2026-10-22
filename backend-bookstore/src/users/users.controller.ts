import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Put,
  Delete,
  Param,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  register(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @UseGuards(AuthGuard)
  @Get('profile')
  getProfile(@Req() request: any) {
    const userId = request.user.sub;
    return this.usersService.getProfile(userId);
  }

  @UseGuards(AuthGuard)
  @Put('profile')
  updateProfile(@Req() request: any, @Body() dto: UpdateProfileDto) {
    const userId = request.user.sub;
    return this.usersService.updateProfile(userId, dto);
  }

  @UseGuards(AuthGuard)
  @Delete('profile')
  deleteAccount(@Req() request: any) {
    const userId = request.user.sub;
    return this.usersService.deleteAccount(userId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  // --- Address Book ---

  @UseGuards(AuthGuard)
  @Get('addresses')
  getAddresses(@Req() request: any) {
    const userId = request.user.sub;
    return this.usersService.getAddresses(userId);
  }

  @UseGuards(AuthGuard)
  @Post('addresses')
  addAddress(@Req() request: any, @Body() dto: CreateAddressDto) {
    const userId = request.user.sub;
    return this.usersService.addAddress(userId, dto);
  }

  @UseGuards(AuthGuard)
  @Put('addresses/:id')
  updateAddress(
    @Req() request: any,
    @Param('id') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    const userId = request.user.sub;
    return this.usersService.updateAddress(userId, addressId, dto);
  }

  @UseGuards(AuthGuard)
  @Delete('addresses/:id')
  deleteAddress(@Req() request: any, @Param('id') addressId: string) {
    const userId = request.user.sub;
    return this.usersService.deleteAddress(userId, addressId);
  }
}
